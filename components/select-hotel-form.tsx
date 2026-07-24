"use client";

import { useFormStatus } from "react-dom";
import { selectHotelAction } from "@/actions/hotels";
import type { HotelOfferView } from "@/lib/hotel-offer-view";

/* Submit button reads pending state from the enclosing form (WF §8). */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="select-hotel-submit"
      className="press-physical inline-flex min-h-13 items-center justify-center rounded-pill bg-sunset px-s6 text-lg font-semibold text-ink shadow-e2 hover:bg-sunset-deep hover:text-paper2 disabled:opacity-60"
    >
      {pending ? "Selecting…" : "Select this hotel"}
    </button>
  );
}

export function SelectHotelForm({
  offer,
  search,
}: {
  offer: HotelOfferView;
  search: {
    city: string;
    country: string;
    checkin: string;
    checkout: string;
    guests: number;
    rooms: number;
  };
}) {
  const payload = JSON.stringify({ offer, search });
  return (
    <form action={selectHotelAction}>
      <input type="hidden" name="payload" value={payload} />
      <SubmitButton />
    </form>
  );
}
