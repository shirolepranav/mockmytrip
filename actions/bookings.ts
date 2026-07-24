"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import { getDraft } from "@/lib/services/trips";
import { createBooking, EmptyDraftError } from "@/lib/services/bookings";

/*
 * Thin Server Action wrapper (zero business logic — TECH_SPEC §3) around
 * lib/services/bookings.ts::createBooking.
 */

const confirmSchema = z.object({
  email: z.email("That doesn't look like an email").or(z.literal("")),
});

export interface ConfirmBookingState {
  status: "idle" | "error";
  message?: string;
}

export async function confirmBookingAction(
  _previous: ConfirmBookingState,
  formData: FormData,
): Promise<ConfirmBookingState> {
  const parsed = confirmSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }
  const email = parsed.data.email || undefined;

  const userId = await readSessionUserId();
  if (!userId) {
    redirect("/search/flights?notice=need-flight");
  }

  let result;
  try {
    const draft = await getDraft(userId);
    result = await createBooking(userId, draft, email);
  } catch (error) {
    if (error instanceof EmptyDraftError) {
      redirect("/search/flights?notice=need-flight");
    }
    console.error("checkout confirm failed", error);
    return {
      status: "error",
      message: "Something went wrong — your trip is still saved. Try again.",
    };
  }

  // Reveal + email-status are one-time query flags read by the confirmation
  // page, then scrubbed client-side — not persisted (purely transient UI).
  redirect(
    `/trip/confirmation/${result.bookingId}?justBooked=1&emailStatus=${result.emailStatus}`,
  );
}
