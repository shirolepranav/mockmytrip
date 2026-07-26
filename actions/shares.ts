"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { establishSession, readSessionUserId } from "@/lib/auth/session";
import { getOrCreateGuest } from "@/lib/services/users";
import { OwnershipError } from "@/lib/services/ownership";
import {
  ShareGoneError,
  ShareNotEditableError,
  ShareRateLimitError,
  createShare,
  joinAsCollaborator,
  leaveTrip,
  removeCollaborator,
  revokeShare,
  setCollaboratorRole,
  setPermission,
  type CollaboratorRole,
  type SharePermission,
  type TripShareRow,
} from "@/lib/services/shares";

/*
 * Thin wrappers over lib/services/shares (no business logic here) — same
 * shape as actions/itinerary.ts's guardOwnership pattern.
 */

async function guardOwnership<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof OwnershipError) return null;
    throw error;
  }
}

export interface CreateShareResult {
  share?: TripShareRow;
  error?: "denied" | "rate-limited";
}

const createShareSchema = z.object({
  tripId: z.string().uuid(),
  permission: z.enum(["view", "edit"]),
});

export async function createShareAction(
  input: z.infer<typeof createShareSchema>,
): Promise<CreateShareResult> {
  const parsed = createShareSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return { error: "denied" };
  try {
    const share = await guardOwnership(() =>
      createShare(userId, parsed.tripId, parsed.permission),
    );
    if (!share) return { error: "denied" };
    revalidatePath(`/trips/${parsed.tripId}`);
    return { share };
  } catch (error) {
    if (error instanceof ShareRateLimitError) return { error: "rate-limited" };
    throw error;
  }
}

const shareIdSchema = z.object({
  shareId: z.string().uuid(),
  tripId: z.string().uuid(),
});

export async function revokeShareAction(
  input: z.infer<typeof shareIdSchema>,
): Promise<boolean> {
  const parsed = shareIdSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return false;
  // /s/[token] always reads live (no cache to invalidate) — revocation is
  // immediate there; this revalidatePath is just for the owner's own UI.
  const result = await guardOwnership(() => revokeShare(userId, parsed.shareId));
  revalidatePath(`/trips/${parsed.tripId}`);
  revalidatePath("/settings");
  return result !== null;
}

const setPermissionSchema = z.object({
  shareId: z.string().uuid(),
  tripId: z.string().uuid(),
  permission: z.enum(["view", "edit"]),
});

export async function setPermissionAction(
  input: z.infer<typeof setPermissionSchema>,
): Promise<boolean> {
  const parsed = setPermissionSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return false;
  const result = await guardOwnership(() =>
    setPermission(userId, parsed.shareId, parsed.permission as SharePermission),
  );
  revalidatePath(`/trips/${parsed.tripId}`);
  return result !== null;
}

const collaboratorIdSchema = z.object({
  collaboratorId: z.string().uuid(),
  tripId: z.string().uuid(),
});

export async function removeCollaboratorAction(
  input: z.infer<typeof collaboratorIdSchema>,
): Promise<boolean> {
  const parsed = collaboratorIdSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return false;
  const result = await guardOwnership(() => removeCollaborator(userId, parsed.collaboratorId));
  revalidatePath(`/trips/${parsed.tripId}`);
  return result !== null;
}

const setCollaboratorRoleSchema = z.object({
  collaboratorId: z.string().uuid(),
  tripId: z.string().uuid(),
  role: z.enum(["viewer", "editor"]),
});

export async function setCollaboratorRoleAction(
  input: z.infer<typeof setCollaboratorRoleSchema>,
): Promise<boolean> {
  const parsed = setCollaboratorRoleSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return false;
  const result = await guardOwnership(() =>
    setCollaboratorRole(userId, parsed.collaboratorId, parsed.role as CollaboratorRole),
  );
  revalidatePath(`/trips/${parsed.tripId}`);
  return result !== null;
}

const leaveTripSchema = z.object({ tripId: z.string().uuid() });

/** Self-service: a collaborator leaving a trip they were invited to (Settings). */
export async function leaveTripAction(
  input: z.infer<typeof leaveTripSchema>,
): Promise<void> {
  const parsed = leaveTripSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return;
  await leaveTrip(userId, parsed.tripId);
  revalidatePath("/trips");
  revalidatePath("/settings");
}

/**
 * "Add your ideas" on the public shared page: silently establishes a guest
 * session if the visitor has none yet (same pattern as
 * acknowledgeSimulationAction/selectFlightAction), joins as a collaborator,
 * then sends them to the real, fully-interactive itinerary page — this
 * route never renders an editable board itself. Failure redirects back to
 * the share page with a friendly inline message rather than throwing.
 */
export async function joinSharedTripAction(token: string): Promise<void> {
  const existing = await readSessionUserId();
  const user = await getOrCreateGuest(existing);
  await establishSession(user.id);

  // The join call is isolated in its own try/catch so `redirect()`'s
  // internal control-flow throw (below, on every path) is never at risk of
  // being mistaken for one of these two expected failure modes.
  let tripId: string | null;
  try {
    const result = await joinAsCollaborator(token, user.id);
    tripId = "alreadyOwner" in result ? null : result.tripId;
  } catch (error) {
    if (error instanceof ShareGoneError) redirect(`/s/${token}?joined=gone`);
    if (error instanceof ShareNotEditableError) redirect(`/s/${token}?joined=view-only`);
    throw error;
  }

  if (tripId) redirect(`/trips/${tripId}/itinerary`);
  redirect(`/trips`); // owner clicked their own link — just take them to their trip normally
}
