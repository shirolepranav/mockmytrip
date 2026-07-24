"use client";

import { useActionState } from "react";
import { confirmBookingAction, type ConfirmBookingState } from "@/actions/bookings";

const initialState: ConfirmBookingState = { status: "idle" };

/* Checkout form (WF §10): optional email, zero payment fields, Confirm CTA. */
export function CheckoutForm() {
  const [state, formAction, pending] = useActionState(
    confirmBookingAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-s4">
      <div className="flex flex-col gap-s2">
        <label htmlFor="checkout-email" className="font-semibold">
          Send my boarding pass? (optional)
        </label>
        <input
          id="checkout-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          data-testid="checkout-email-input"
          className="min-h-11 rounded-card border border-line bg-paper2 px-s3 text-base"
        />
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm font-semibold text-alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="confirm-booking-submit"
        className="press-physical inline-flex min-h-13 items-center justify-center rounded-pill bg-sunset px-s6 text-lg font-semibold text-ink shadow-e2 hover:bg-sunset-deep hover:text-paper2 disabled:opacity-60"
      >
        {pending ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
