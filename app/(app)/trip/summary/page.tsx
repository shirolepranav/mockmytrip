import Link from "next/link";
import { requireFlightDraft } from "@/lib/hotel-guard";
import { summarizeDraft, generateTripTitle } from "@/lib/trip-summary";
import { resultsParamsSchema, resultsQueryString } from "@/lib/search-params";
import {
  hotelResultsParamsSchema,
  hotelResultsQueryString,
} from "@/lib/hotel-search-params";
import { TripTitleEditor } from "@/components/trip-title-editor";
import { TripSegmentCard } from "@/components/trip-segment-card";
import { formatMoney } from "@/lib/format";

/*
 * Trip summary (WF §9): assembles the accumulated flight(s) + optional
 * hotel into totals, an editable auto-title, edit-segment links that
 * return to the right search preserving state, and the checkout CTA.
 * Flight is required (enforced by requireFlightDraft); hotel is optional
 * (task 6's "missing piece" state below).
 */

export const metadata = { title: "Trip summary" };

export default async function TripSummaryPage() {
  const draft = await requireFlightDraft();
  const summary = summarizeDraft(draft);

  // Edit links reconstruct the original search so re-opening it preserves
  // state, the same technique the flight results page uses for its own
  // "Edit search" link.
  const searchResult = resultsParamsSchema.safeParse(draft.search);
  const flightEditHref = searchResult.success
    ? `/search/flights/results?${resultsQueryString({ ...searchResult.data, leg: "outbound" })}`
    : "/search/flights";
  const returnEditHref = searchResult.success
    ? `/search/flights/results?${resultsQueryString({ ...searchResult.data, leg: "return" })}`
    : "/search/flights";

  const hotelSearchResult = hotelResultsParamsSchema.safeParse(
    draft.hotelSearch,
  );
  const hotelEditHref = hotelSearchResult.success
    ? `/search/hotels/results?${hotelResultsQueryString(hotelSearchResult.data)}`
    : "/search/hotels";

  const title =
    summary.title ??
    generateTripTitle(summary.destinationCity ?? "your trip", summary.nights);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-s5">
      <header className="flex flex-col gap-s2">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          Trip summary
        </p>
        <TripTitleEditor key={title} initialTitle={title} />
      </header>

      <div className="flex flex-col gap-s3">
        {summary.flight ? (
          <TripSegmentCard
            kind="flight"
            label={summary.hasReturnFlight ? "Outbound flight" : "Flight"}
            offer={summary.flight}
            editHref={flightEditHref}
          />
        ) : null}
        {summary.returnFlight ? (
          <TripSegmentCard
            kind="flight"
            label="Return flight"
            offer={summary.returnFlight}
            editHref={returnEditHref}
          />
        ) : null}

        {summary.hotel ? (
          <TripSegmentCard
            kind="hotel"
            offer={summary.hotel}
            editHref={hotelEditHref}
          />
        ) : (
          <div className="ticket-surface flex flex-col items-start gap-s3 p-s5">
            <h2 className="font-display text-lg">No stay added yet</h2>
            <p className="text-sm text-ink-soft">
              Add a hotel to round out the trip, or continue without one —
              totally fine.
            </p>
            <Link
              href="/search/hotels"
              className="min-h-11 rounded-pill bg-ink px-s4 py-s2 text-sm font-semibold text-paper2"
            >
              Add a hotel
            </Link>
          </div>
        )}
      </div>

      <div className="ticket-surface flex flex-col gap-s2 p-s5">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg">Total</p>
          <div className="text-right">
            <p
              data-testid="trip-grand-total"
              className="text-sm text-ink-soft line-through"
            >
              {formatMoney(summary.grandTotalCents)}
            </p>
            <p className="font-serif text-2xl font-semibold">$0.00</p>
          </div>
        </div>
        <p
          data-testid="trip-total-saved"
          className="text-right text-sm font-semibold text-mint-ok"
        >
          you&apos;d save {formatMoney(summary.totalSavedCents)}
        </p>
      </div>

      <Link
        href="/trip/checkout"
        data-testid="continue-to-checkout"
        className="press-physical inline-flex min-h-13 items-center justify-center rounded-pill bg-sunset px-s6 text-lg font-semibold text-ink shadow-e2 hover:bg-sunset-deep hover:text-paper2"
      >
        Continue to checkout
      </Link>
    </section>
  );
}
