"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/*
 * Sort + filter toolbar. URL-param driven (Phase 3 task 6) so results stay
 * deterministic and shareable; refresh preserves state.
 */

const SORTS = [
  { value: "price", label: "Price" },
  { value: "duration", label: "Duration" },
  { value: "departure", label: "Departure" },
] as const;

const TIMES = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const;

export function ResultsToolbar({
  airlines,
}: {
  airlines: { code: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) params.delete(key);
      else params.set(key, value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const sort = searchParams.get("sort") ?? "departure";
  const nonstop = searchParams.get("stops") === "0";
  const time = searchParams.get("time");
  const airlineFilter = searchParams.get("airlines")?.split(",") ?? [];

  const toggleAirline = (code: string) => {
    const next = airlineFilter.includes(code)
      ? airlineFilter.filter((entry) => entry !== code)
      : [...airlineFilter, code];
    setParam("airlines", next.length > 0 ? next.join(",") : null);
  };

  return (
    <div className="flex flex-col gap-s3">
      <div className="flex flex-wrap items-center gap-s3">
        <label htmlFor="sort" className="text-sm font-semibold">
          Sort
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(event) =>
            setParam(
              "sort",
              event.target.value === "departure" ? null : event.target.value,
            )
          }
          className="min-h-11 rounded-card border border-line bg-paper2 px-s3"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-pressed={nonstop}
          onClick={() => setParam("stops", nonstop ? null : "0")}
          className={`min-h-11 rounded-pill border px-s4 text-sm font-semibold ${
            nonstop
              ? "border-ink bg-ink text-paper2"
              : "border-line bg-paper2 text-ink-soft"
          }`}
        >
          Nonstop only
        </button>

        <div role="group" aria-label="Time of day" className="flex gap-s1">
          {TIMES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={time === option.value}
              onClick={() =>
                setParam("time", time === option.value ? null : option.value)
              }
              className={`min-h-11 rounded-pill border px-s3 text-sm font-semibold ${
                time === option.value
                  ? "border-ink bg-ink text-paper2"
                  : "border-line bg-paper2 text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {airlines.length > 1 ? (
        <div
          role="group"
          aria-label="Airlines"
          className="flex flex-wrap gap-s1"
        >
          {airlines.map((airline) => (
            <button
              key={airline.code}
              type="button"
              aria-pressed={airlineFilter.includes(airline.code)}
              onClick={() => toggleAirline(airline.code)}
              className={`min-h-11 rounded-pill border px-s3 text-sm ${
                airlineFilter.includes(airline.code)
                  ? "border-horizon-deep bg-horizon text-paper2"
                  : "border-line bg-paper2 text-ink-soft"
              }`}
            >
              {airline.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
