"use client";

import { useFormStatus } from "react-dom";
import { skipHotelAction } from "@/actions/hotels";

/*
 * "Skip hotels" (WF §6, QA 4.7). A single tap, no confirm-shaming (golden
 * rule #3) — skipping is a completely normal path, not a mistake to guard
 * against.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="skip-hotels-submit"
      className="min-h-11 rounded-pill border border-line bg-paper2 px-s4 py-s2 text-sm font-semibold text-ink-soft hover:text-ink disabled:opacity-60"
    >
      {pending ? "Skipping…" : "Skip hotels for now"}
    </button>
  );
}

export function SkipHotelButton() {
  return (
    <form action={skipHotelAction}>
      <SubmitButton />
    </form>
  );
}
