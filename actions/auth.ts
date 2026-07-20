"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  RateLimitError,
  requestMagicLink,
} from "@/lib/services/auth";
import { getOrCreateGuest } from "@/lib/services/users";
import { establishSession, readSessionUserId } from "@/lib/auth/session";

/*
 * Thin Server Action wrappers (zero business logic — TECH_SPEC §3).
 */

const emailSchema = z.object({
  email: z.email("That doesn't look like an email"),
});

export interface MagicLinkState {
  status: "idle" | "sent" | "error";
  message?: string;
}

export async function requestMagicLinkAction(
  _previous: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  try {
    await requestMagicLink(parsed.data.email, `${protocol}://${host}`);
    return {
      status: "sent",
      message: "Check your inbox — your sign-in link is on its way.",
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { status: "error", message: error.message };
    }
    return {
      status: "error",
      message: "Something went sideways — try again in a moment.",
    };
  }
}

/** Acknowledge the simulation disclosure: create guest + session, go search. */
export async function acknowledgeSimulationAction(): Promise<void> {
  const existing = await readSessionUserId();
  const user = await getOrCreateGuest(existing);
  await establishSession(user.id);
  redirect("/search/flights");
}
