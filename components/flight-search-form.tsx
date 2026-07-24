"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AirportAutocomplete } from "@/components/airport-autocomplete";
import { IconMinus, IconPlus, IconSwap } from "@/components/icons";
import type { SlimAirport } from "@/lib/airports-client";
import {
  validateFlightSearchForm,
  type FlightSearchFormErrors,
} from "@/lib/validation/flight-search-form";

/*
 * Flight search form (WF §3). Zod-validated with inline errors; submits to
 * the results page via URL params so searches are shareable and deterministic.
 */

const CABINS = [
  { value: "economy", label: "Economy" },
  { value: "premium", label: "Premium economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FlightSearchForm({
  initial,
}: {
  initial?: Partial<{
    origin: string;
    destination: string;
    departDate: string;
    returnDate: string;
    passengers: number;
    cabin: string;
  }>;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState<SlimAirport | null>(null);
  const [destination, setDestination] = useState<SlimAirport | null>(null);
  const [roundTrip, setRoundTrip] = useState(Boolean(initial?.returnDate));
  const [departDate, setDepartDate] = useState(initial?.departDate ?? "");
  const [returnDate, setReturnDate] = useState(initial?.returnDate ?? "");
  const [passengers, setPassengers] = useState(initial?.passengers ?? 1);
  const [cabin, setCabin] = useState(initial?.cabin ?? "economy");
  const [errors, setErrors] = useState<FlightSearchFormErrors>({});
  const [swapTick, setSwapTick] = useState(0);

  const minDate = useMemo(() => todayIso(), []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateFlightSearchForm({
      origin: origin?.iata ?? null,
      destination: destination?.iata ?? null,
      departDate,
      minDate,
      roundTrip,
      returnDate: roundTrip ? returnDate : undefined,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const params = new URLSearchParams({
      o: origin!.iata,
      d: destination!.iata,
      depart: departDate,
      pax: String(passengers),
      cabin,
    });
    if (roundTrip && returnDate) params.set("return", returnDate);
    router.push(`/search/flights/results?${params.toString()}`);
  }

  function swap() {
    const a = origin;
    setOrigin(destination);
    setDestination(a);
    setSwapTick((tick) => tick + 1); // remount autocompletes with new initials
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-s4">
      <fieldset className="flex flex-col gap-s3">
        <legend className="sr-only">Route</legend>
        <AirportAutocomplete
          key={`o-${swapTick}-${origin?.iata ?? ""}`}
          label="From"
          name="origin"
          initial={origin}
          error={errors.origin}
          onSelect={setOrigin}
        />
        <div className="relative">
          <button
            type="button"
            onClick={swap}
            aria-label="Swap origin and destination"
            className="absolute -top-s4 right-s3 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill border border-line bg-paper2 text-horizon-deep shadow-e1"
          >
            <IconSwap size={18} />
          </button>
        </div>
        <AirportAutocomplete
          key={`d-${swapTick}-${destination?.iata ?? ""}`}
          label="To"
          name="destination"
          initial={destination}
          error={errors.destination}
          onSelect={setDestination}
        />
      </fieldset>

      <fieldset className="flex flex-wrap items-start gap-s3">
        <legend className="sr-only">Dates</legend>
        <div
          role="radiogroup"
          aria-label="Trip type"
          className="flex w-full gap-s1 rounded-pill border border-line bg-paper2 p-s1"
        >
          {[
            { value: false, label: "One way" },
            { value: true, label: "Round trip" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={roundTrip === option.value}
              onClick={() => setRoundTrip(option.value)}
              className={`min-h-11 flex-1 rounded-pill font-semibold ${
                roundTrip === option.value
                  ? "bg-ink text-paper2"
                  : "text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex min-w-40 flex-1 flex-col gap-s1">
          <label htmlFor="depart-date" className="text-sm font-semibold">
            Departure
          </label>
          <input
            id="depart-date"
            type="date"
            required
            min={minDate}
            value={departDate}
            onChange={(event) => setDepartDate(event.target.value)}
            aria-invalid={errors.departDate ? true : undefined}
            aria-describedby={errors.departDate ? "depart-error" : undefined}
            className="min-h-12 rounded-card border border-line bg-paper2 px-s3 font-serif"
          />
          {errors.departDate ? (
            <p id="depart-error" role="alert" className="text-sm text-alert">
              {errors.departDate}
            </p>
          ) : null}
        </div>

        {roundTrip ? (
          <div className="flex min-w-40 flex-1 flex-col gap-s1">
            <label htmlFor="return-date" className="text-sm font-semibold">
              Return
            </label>
            <input
              id="return-date"
              type="date"
              min={departDate || minDate}
              value={returnDate}
              onChange={(event) => setReturnDate(event.target.value)}
              aria-invalid={errors.returnDate ? true : undefined}
              aria-describedby={errors.returnDate ? "return-error" : undefined}
              className="min-h-12 rounded-card border border-line bg-paper2 px-s3 font-serif"
            />
            {errors.returnDate ? (
              <p id="return-error" role="alert" className="text-sm text-alert">
                {errors.returnDate}
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-wrap items-end gap-s4">
        <legend className="sr-only">Travelers and cabin</legend>
        <div className="flex flex-col gap-s1">
          <span id="pax-label" className="text-sm font-semibold">
            Dreamers
          </span>
          <div
            role="group"
            aria-labelledby="pax-label"
            className="flex items-center gap-s2"
          >
            <button
              type="button"
              aria-label="Fewer travelers"
              disabled={passengers <= 1}
              onClick={() => setPassengers((count) => Math.max(1, count - 1))}
              className="flex size-11 items-center justify-center rounded-pill border border-line bg-paper2 disabled:opacity-40"
            >
              <IconMinus size={18} />
            </button>
            <output
              aria-live="polite"
              className="min-w-8 text-center font-serif text-xl"
            >
              {passengers}
            </output>
            <button
              type="button"
              aria-label="More travelers"
              disabled={passengers >= 9}
              onClick={() => setPassengers((count) => Math.min(9, count + 1))}
              className="flex size-11 items-center justify-center rounded-pill border border-line bg-paper2 disabled:opacity-40"
            >
              <IconPlus size={18} />
            </button>
          </div>
        </div>

        <div className="flex min-w-44 flex-1 flex-col gap-s1">
          <label htmlFor="cabin" className="text-sm font-semibold">
            Cabin
          </label>
          <select
            id="cabin"
            value={cabin}
            onChange={(event) => setCabin(event.target.value)}
            className="min-h-12 rounded-card border border-line bg-paper2 px-s3"
          >
            {CABINS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <button
        type="submit"
        data-testid="search-flights-submit"
        className="press-physical mt-s2 inline-flex min-h-13 items-center justify-center rounded-pill bg-sunset px-s6 text-lg font-semibold text-ink shadow-e2 hover:bg-sunset-deep hover:text-paper2"
      >
        Search flights
      </button>
    </form>
  );
}
