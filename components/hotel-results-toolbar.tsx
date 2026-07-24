"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/*
 * Sort + filter toolbar for hotel results, mirroring results-toolbar.tsx:
 * URL-param driven so results stay deterministic and shareable; refresh
 * preserves state.
 */

const SORTS = [
  { value: "price", label: "Price" },
  { value: "stars", label: "Stars" },
] as const;

const STAR_OPTIONS = ["3", "4", "5"] as const;

export function HotelResultsToolbar({
  amenities,
}: {
  amenities: string[];
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

  const sort = searchParams.get("sort") ?? "price";
  const minStars = searchParams.get("minStars");
  const amenityFilter = searchParams.get("amenities")?.split(",") ?? [];

  const toggleAmenity = (amenity: string) => {
    const next = amenityFilter.includes(amenity)
      ? amenityFilter.filter((entry) => entry !== amenity)
      : [...amenityFilter, amenity];
    setParam("amenities", next.length > 0 ? next.join(",") : null);
  };

  return (
    <div className="flex flex-col gap-s3">
      <div className="flex flex-wrap items-center gap-s3">
        <label htmlFor="hotel-sort" className="text-sm font-semibold">
          Sort
        </label>
        <select
          id="hotel-sort"
          value={sort}
          onChange={(event) =>
            setParam(
              "sort",
              event.target.value === "price" ? null : event.target.value,
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

        <div
          role="group"
          aria-label="Minimum star rating"
          className="flex gap-s1"
        >
          {STAR_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={minStars === option}
              onClick={() =>
                setParam("minStars", minStars === option ? null : option)
              }
              className={`min-h-11 rounded-pill border px-s3 text-sm font-semibold ${
                minStars === option
                  ? "border-ink bg-ink text-paper2"
                  : "border-line bg-paper2 text-ink-soft"
              }`}
            >
              {option}★+
            </button>
          ))}
        </div>
      </div>

      {amenities.length > 1 ? (
        <div role="group" aria-label="Amenities" className="flex flex-wrap gap-s1">
          {amenities.map((amenity) => (
            <button
              key={amenity}
              type="button"
              aria-pressed={amenityFilter.includes(amenity)}
              onClick={() => toggleAmenity(amenity)}
              className={`min-h-11 rounded-pill border px-s3 text-sm ${
                amenityFilter.includes(amenity)
                  ? "border-horizon-deep bg-horizon text-paper2"
                  : "border-line bg-paper2 text-ink-soft"
              }`}
            >
              {amenity}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
