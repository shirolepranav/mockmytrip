// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

/*
 * @phase9 sharing/collaboration suite against embedded in-memory PGlite:
 * token shape, rate limiting (QA 9.10), revoke (QA 9.4), join idempotency
 * (QA 9.5), ownership boundaries (QA 9.7/9.8), and the shared-view privacy
 * whitelist (QA 9.3).
 */

process.env.PGLITE_MEMORY = "1";

import { getDb } from "@/lib/db/client";
import { createGuest, setDisplayName } from "@/lib/services/users";
import { createTrip } from "@/lib/services/trips";
import { addItineraryItem } from "@/lib/services/itinerary";
import { OwnershipError } from "./ownership";
import {
  ShareGoneError,
  ShareNotEditableError,
  ShareRateLimitError,
  createShare,
  getActiveShareByToken,
  getSharedTripView,
  joinAsCollaborator,
  leaveTrip,
  listAllSharesForUser,
  listCollaboratingTrips,
  listCollaborators,
  listShares,
  removeCollaborator,
  revokeShare,
  setCollaboratorRole,
  setPermission,
} from "./shares";

beforeAll(async () => {
  await getDb(); // triggers embedded migration
});

async function makeTrip(userId: string) {
  return createTrip(userId, {
    title: "Test trip",
    destinationCity: "Lisbon",
    destinationCountry: "PT",
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-09-04T00:00:00Z"),
  });
}

describe("@phase9 createShare", () => {
  it("9.1 generates a 22-char base62 token, not derived from tripId", async () => {
    const owner = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "view");

    expect(share.token).toHaveLength(22);
    expect(share.token).toMatch(/^[0-9A-Za-z]{22}$/);
    expect(share.token).not.toContain(trip.id);
    expect(share.permission).toBe("view");
    expect(share.isRevoked).toBe(false);
  });

  it("only the trip owner can create a share", async () => {
    const owner = await createGuest();
    const stranger = await createGuest();
    const trip = await makeTrip(owner.id);
    await expect(createShare(stranger.id, trip.id, "view")).rejects.toThrow(
      OwnershipError,
    );
  });

  it("9.10 the 10th share in a day succeeds, the 11th is rate-limited", async () => {
    const owner = await createGuest();
    const trip = await makeTrip(owner.id);
    for (let i = 0; i < 10; i++) {
      await expect(createShare(owner.id, trip.id, "view")).resolves.toBeDefined();
    }
    await expect(createShare(owner.id, trip.id, "view")).rejects.toThrow(
      ShareRateLimitError,
    );
  });
});

describe("@phase9 revoke / permission", () => {
  it("9.4 a revoked share is no longer active", async () => {
    const owner = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "edit");

    expect(await getActiveShareByToken(share.token)).not.toBeNull();
    await revokeShare(owner.id, share.id);
    expect(await getActiveShareByToken(share.token)).toBeNull();
    expect(await getSharedTripView(share.token)).toBeNull();
  });

  it("only the owner can revoke or change permission", async () => {
    const owner = await createGuest();
    const stranger = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "view");

    await expect(revokeShare(stranger.id, share.id)).rejects.toThrow(OwnershipError);
    await expect(
      setPermission(stranger.id, share.id, "edit"),
    ).rejects.toThrow(OwnershipError);

    await setPermission(owner.id, share.id, "edit");
    const [reloaded] = await listShares(owner.id, trip.id);
    expect(reloaded.permission).toBe("edit");
  });
});

describe("@phase9 joinAsCollaborator", () => {
  it("9.5 an edit-permission join creates an editor collaborator row", async () => {
    const owner = await createGuest();
    const guest = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "edit");

    const result = await joinAsCollaborator(share.token, guest.id);
    expect("alreadyOwner" in result).toBe(false);
    if (!("alreadyOwner" in result)) {
      expect(result.role).toBe("editor");
      expect(result.tripId).toBe(trip.id);
    }

    const trips = await listCollaboratingTrips(guest.id);
    expect(trips.map((t) => t.trip.id)).toContain(trip.id);
  });

  it("a view-only link cannot be joined as a collaborator", async () => {
    const owner = await createGuest();
    const guest = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "view");
    await expect(joinAsCollaborator(share.token, guest.id)).rejects.toThrow(
      ShareNotEditableError,
    );
  });

  it("the owner clicking their own edit link is a no-op", async () => {
    const owner = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "edit");
    const result = await joinAsCollaborator(share.token, owner.id);
    expect(result).toEqual({ alreadyOwner: true });
  });

  it("re-joining an active edit link is idempotent and re-upgrades a downgraded viewer", async () => {
    const owner = await createGuest();
    const guest = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "edit");

    const first = await joinAsCollaborator(share.token, guest.id);
    if ("alreadyOwner" in first) throw new Error("unexpected");
    await setCollaboratorRole(owner.id, first.id, "viewer");

    const rejoined = await joinAsCollaborator(share.token, guest.id);
    if ("alreadyOwner" in rejoined) throw new Error("unexpected");
    expect(rejoined.id).toBe(first.id);
    expect(rejoined.role).toBe("editor");
  });

  it("joining a revoked link throws ShareGoneError", async () => {
    const owner = await createGuest();
    const guest = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "edit");
    await revokeShare(owner.id, share.id);
    await expect(joinAsCollaborator(share.token, guest.id)).rejects.toThrow(
      ShareGoneError,
    );
  });
});

describe("@phase9 collaborator management", () => {
  it("9.7/9.8 only the owner can remove or downgrade a collaborator", async () => {
    const owner = await createGuest();
    const editor = await createGuest();
    const stranger = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "edit");
    const collaborator = await joinAsCollaborator(share.token, editor.id);
    if ("alreadyOwner" in collaborator) throw new Error("unexpected");

    await expect(
      setCollaboratorRole(stranger.id, collaborator.id, "viewer"),
    ).rejects.toThrow(OwnershipError);
    await expect(removeCollaborator(stranger.id, collaborator.id)).rejects.toThrow(
      OwnershipError,
    );

    await setCollaboratorRole(owner.id, collaborator.id, "viewer");
    const [updated] = await listCollaborators(owner.id, trip.id);
    expect(updated.role).toBe("viewer");

    await removeCollaborator(owner.id, collaborator.id);
    expect(await listCollaborators(owner.id, trip.id)).toHaveLength(0);
  });

  it("leaveTrip is self-service — no owner check required", async () => {
    const owner = await createGuest();
    const editor = await createGuest();
    const trip = await makeTrip(owner.id);
    const share = await createShare(owner.id, trip.id, "edit");
    await joinAsCollaborator(share.token, editor.id);

    await leaveTrip(editor.id, trip.id);
    expect(await listCollaborators(owner.id, trip.id)).toHaveLength(0);
  });

  it("listAllSharesForUser only returns this owner's shares", async () => {
    const owner = await createGuest();
    const other = await createGuest();
    const tripA = await makeTrip(owner.id);
    const tripB = await makeTrip(other.id);
    await createShare(owner.id, tripA.id, "view");
    await createShare(other.id, tripB.id, "view");

    const shares = await listAllSharesForUser(owner.id);
    expect(shares).toHaveLength(1);
    expect(shares[0].tripId).toBe(tripA.id);
  });
});

describe("@phase9 getSharedTripView privacy", () => {
  it("9.3 the returned trip view exposes only the whitelisted fields — no email/savings/other-trip data", async () => {
    const owner = await createGuest();
    await setDisplayName(owner.id, "Priya");
    const trip = await makeTrip(owner.id);
    await addItineraryItem(owner.id, trip.id, {
      dayIndex: 0,
      title: "Pastel de nata crawl",
      category: "food",
    });
    const share = await createShare(owner.id, trip.id, "view");

    const view = await getSharedTripView(share.token);
    expect(view).not.toBeNull();
    if (!view) throw new Error("unexpected");

    expect(Object.keys(view.trip).sort()).toEqual(
      [
        "coverSeed",
        "destinationCity",
        "destinationCountry",
        "endDate",
        "id",
        "startDate",
        "status",
        "title",
      ].sort(),
    );
    expect(view.ownerDisplayName).toBe("Priya");
    expect(JSON.stringify(view)).not.toContain("totalSavedCents");
    expect(view.items).toHaveLength(1);
  });
});
