"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AirportAutocomplete } from "@/components/airport-autocomplete";
import { IconMinus, IconPlus } from "@/components/icons";
import type { SlimAirport } from "@/lib/airports-client";
import {
  validateHotelSearchForm,
  type HotelSearchFormErrors,
} from "@/lib/validation/hotel-search-form";

/*
 * Hotel search form (WF §6). Destination reuses AirportAutocomplete (the
 * only city-resolution UI in the codebase) since hotels only need
 * {city, country} — the picked airport's IATA is discarded. Zod-validated
 * with inline errors; submits to the results page via URL params so
 * searches stay shareable and deterministic, mirroring FlightSearchForm.
 */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HotelSearchForm({
  initial,
}: {
  initial?: {
    destination?: SlimAirport | null;
    checkin?: string;
    checkout?: string;
    guests?: number;
    rooms?: number;
  };
}) {
  const router = useRouter();
  const [destination, setDestination] = useState<SlimAirport | null>(
    initial?.destination ?? null,
  );
  const [checkin, setCheckin] = useState(initial?.checkin ?? "");
  const [checkout, setCheckout] = useState(initial?.checkout ?? "");
  const [guests, setGuests] = useState(initial?.guests ?? 2);
  const [rooms, setRooms] = useState(initial?.rooms ?? 1);
  const [errors, setErrors] = useState<HotelSearchFormErrors>({});

  const minDate = useMemo(() => todayIso(), []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateHotelSearchForm({
      city: destination?.city ?? null,
      country: destination?.country ?? null,
      checkin,
      checkout,
      minDate,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const params = new URLSearchParams({
      city: destination!.city,
      country: destination!.country,
      checkin,
      checkout,
      guests: String(guests),
      rooms: String(rooms),
    });
    router.push(`/search/hotels/results?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-s4">
      <AirportAutocomplete
        label="Where are you staying?"
        name="destination"
        initial={destination}
        error={errors.destination}
        onSelect={setDestination}
      />

      <fieldset className="flex flex-wrap items-start gap-s3">
        <legend className="sr-only">Dates</legend>
        <div className="flex min-w-40 flex-1 flex-col gap-s1">
          <label htmlFor="checkin-date" className="text-sm font-semibold">
            Check-in
          </label>
          <input
            id="checkin-date"
            type="date"
            required
            min={minDate}
            value={checkin}
            onChange={(event) => setCheckin(event.target.value)}
            aria-invalid={errors.checkin ? true : undefined}
            aria-describedby={errors.checkin ? "checkin-error" : undefined}
            className="min-h-12 rounded-card border border-line bg-paper2 px-s3 font-serif"
          />
          {errors.checkin ? (
            <p id="checkin-error" role="alert" className="text-sm text-alert">
              {errors.checkin}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-40 flex-1 flex-col gap-s1">
          <label htmlFor="checkout-date" className="text-sm font-semibold">
            Check-out
          </label>
          <input
            id="checkout-date"
            type="date"
            min={checkin || minDate}
            value={checkout}
            onChange={(event) => setCheckout(event.target.value)}
            aria-invalid={errors.checkout ? true : undefined}
            aria-describedby={errors.checkout ? "checkout-error" : undefined}
            className="min-h-12 rounded-card border border-line bg-paper2 px-s3 font-serif"
          />
          {errors.checkout ? (
            <p id="checkout-error" role="alert" className="text-sm text-alert">
              {errors.checkout}
            </p>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="flex flex-wrap items-end gap-s4">
        <legend className="sr-only">Guests and rooms</legend>
        <div className="flex flex-col gap-s1">
          <span id="guests-label" className="text-sm font-semibold">
            Guests
          </span>
          <div
            role="group"
            aria-labelledby="guests-label"
            className="flex items-center gap-s2"
          >
            <button
              type="button"
              aria-label="Fewer guests"
              disabled={guests <= 1}
              onClick={() => setGuests((count) => Math.max(1, count - 1))}
              className="flex size-11 items-center justify-center rounded-pill border border-line bg-paper2 disabled:opacity-40"
            >
              <IconMinus size={18} />
            </button>
            <output
              aria-live="polite"
              className="min-w-8 text-center font-serif text-xl"
            >
              {guests}
            </output>
            <button
              type="button"
              aria-label="More guests"
              disabled={guests >= 9}
              onClick={() => setGuests((count) => Math.min(9, count + 1))}
              className="flex size-11 items-center justify-center rounded-pill border border-line bg-paper2 disabled:opacity-40"
            >
              <IconPlus size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-s1">
          <span id="rooms-label" className="text-sm font-semibold">
            Rooms
          </span>
          <div
            role="group"
            aria-labelledby="rooms-label"
            className="flex items-center gap-s2"
          >
            <button
              type="button"
              aria-label="Fewer rooms"
              disabled={rooms <= 1}
              onClick={() => setRooms((count) => Math.max(1, count - 1))}
              className="flex size-11 items-center justify-center rounded-pill border border-line bg-paper2 disabled:opacity-40"
            >
              <IconMinus size={18} />
            </button>
            <output
              aria-live="polite"
              className="min-w-8 text-center font-serif text-xl"
            >
              {rooms}
            </output>
            <button
              type="button"
              aria-label="More rooms"
              disabled={rooms >= 4}
              onClick={() => setRooms((count) => Math.min(4, count + 1))}
              className="flex size-11 items-center justify-center rounded-pill border border-line bg-paper2 disabled:opacity-40"
            >
              <IconPlus size={18} />
            </button>
          </div>
        </div>
      </fieldset>

      <button
        type="submit"
        data-testid="search-hotels-submit"
        className="press-physical mt-s2 inline-flex min-h-13 items-center justify-center rounded-pill bg-sunset px-s6 text-lg font-semibold text-ink shadow-e2 hover:bg-sunset-deep hover:text-paper2"
      >
        Search hotels
      </button>
    </form>
  );
}
