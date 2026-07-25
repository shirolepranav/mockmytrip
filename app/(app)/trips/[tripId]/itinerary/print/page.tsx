import { notFound } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import { getItineraryExportData } from "@/lib/itinerary-export-view";
import { OwnershipError } from "@/lib/services/ownership";
import { PrintButton } from "@/components/print-button";

/*
 * Print-friendly / shareable itinerary view (WF §14): usable for a real
 * trip, not just the simulation — every item, POI addresses where sourced,
 * and a footer disclosing that any bookings referenced were simulated.
 */

export const metadata = { title: "Itinerary — print view" };

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  sight: "Sight",
  activity: "Activity",
  transit: "Transit",
  rest: "Rest",
};

export default async function ItineraryPrintPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const userId = await readSessionUserId();
  if (!userId) notFound();

  let data;
  try {
    data = await getItineraryExportData(userId, tripId);
  } catch (error) {
    if (error instanceof OwnershipError) notFound();
    throw error;
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-s6 print:max-w-none">
      <div className="flex items-center justify-between gap-s3 print:hidden">
        <a
          href={`/api/itinerary/${tripId}/pdf`}
          data-testid="itinerary-download-pdf"
          className="press-physical inline-flex min-h-11 items-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
        >
          Download PDF
        </a>
        <PrintButton className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink" />
      </div>

      <header className="flex flex-col gap-s1">
        <h1 className="font-display text-2xl">{data.tripTitle}</h1>
        <p className="text-sm text-ink-soft">
          {data.destinationCity}
          {data.destinationCountry ? `, ${data.destinationCountry}` : ""}
        </p>
      </header>

      {data.itemsByDay.map((items, dayIndex) => (
        <div key={dayIndex} className="flex flex-col gap-s2" data-testid="itinerary-print-day">
          <h2 className="font-display text-lg">Day {dayIndex + 1}</h2>
          {items.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing planned.</p>
          ) : (
            <ul className="flex flex-col gap-s2">
              {items.map((item, index) => (
                <li key={index} className="border-b border-line pb-s2 text-sm">
                  <span className="font-semibold">
                    {item.time ? `${item.time} — ` : ""}
                    {item.title}
                  </span>
                  <span className="ml-s2 text-xs text-ink-soft uppercase">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                  {item.address ? (
                    <p className="text-xs text-ink-soft">{item.address}</p>
                  ) : null}
                  {item.note ? <p className="text-xs text-ink-soft">{item.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <p
        data-testid="itinerary-print-footer"
        className="border-t border-line pt-s3 text-xs text-ink-soft"
      >
        Bookings referenced in this itinerary were part of a Wanderlost
        SIMULATION — nothing here was actually booked. Real-place details
        (names, addresses) are accurate; flights, hotels, and prices are not.
      </p>
    </section>
  );
}
