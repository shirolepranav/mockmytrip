"use client";

import { useFormStatus } from "react-dom";
import { selectFlightAction } from "@/actions/trips";
import type { FlightOfferView } from "@/lib/offer-view";

/* Submit button reads pending state from the enclosing form (WF §5). */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="select-flight-submit"
      className="press-physical inline-flex min-h-13 items-center justify-center rounded-pill bg-sunset px-s6 text-lg font-semibold text-ink shadow-e2 hover:bg-sunset-deep hover:text-paper2 disabled:opacity-60"
    >
      {pending ? "Selecting…" : "Select this flight"}
    </button>
  );
}

export function SelectFlightForm({
  offer,
  leg,
  search,
}: {
  offer: FlightOfferView;
  leg: "outbound" | "return";
  search: {
    o: string;
    d: string;
    depart: string;
    return?: string;
    pax: number;
    cabin: string;
  };
}) {
  const payload = JSON.stringify({ offer, leg, search });
  return (
    <form action={selectFlightAction}>
      <input type="hidden" name="payload" value={payload} />
      <SubmitButton />
    </form>
  );
}
