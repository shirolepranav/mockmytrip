import type { SharedTripView } from "@/lib/services/shares";

/*
 * Read-only day-by-day itinerary for the public /s/[token] page (WF §20c).
 * Deliberately its own small component rather than reusing
 * ItineraryBoard — that board carries interactive/optimistic/offline-queue
 * machinery this page never needs; a joined editor is redirected to the
 * real, fully-interactive /trips/[tripId]/itinerary instead of editing
 * inline here.
 */
export function SharedItineraryList({
  items,
  dayCount,
}: {
  items: SharedTripView["items"];
  dayCount: number;
}) {
  const byDay: SharedTripView["items"][] = Array.from({ length: dayCount }, () => []);
  for (const item of items) {
    if (item.dayIndex >= 0 && item.dayIndex < dayCount) byDay[item.dayIndex].push(item);
  }
  for (const day of byDay) day.sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div
      className="flex flex-col gap-s5 sm:flex-row sm:overflow-x-auto sm:pb-s3"
      data-testid="shared-itinerary"
    >
      {byDay.map((dayItems, dayIndex) => (
        <div
          key={dayIndex}
          className="flex w-full flex-col gap-s3 sm:w-80 sm:shrink-0"
          data-testid={`shared-itinerary-day-${dayIndex}`}
        >
          <h2 className="font-display text-lg">Day {dayIndex + 1}</h2>
          {dayItems.length === 0 ? (
            <p className="rounded-card border border-dashed border-line p-s4 text-center text-sm text-ink-soft">
              Nothing planned yet.
            </p>
          ) : (
            <div className="flex flex-col gap-s3">
              {dayItems.map((item) => (
                <div
                  key={item.id}
                  data-testid="shared-itinerary-item"
                  className="ticket-surface flex flex-col gap-1 p-s3"
                >
                  <span className="flex items-center gap-s2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    {item.time ? <span className="font-mono">{item.time}</span> : null}
                    <span>{item.category}</span>
                  </span>
                  <span className="font-display text-base">{item.title}</span>
                  {item.note ? <span className="text-sm text-ink-soft">{item.note}</span> : null}
                  {item.createdByDisplayName ? (
                    <span
                      data-testid="itinerary-item-attribution"
                      className="mt-1 inline-flex w-fit items-center rounded-pill bg-paper2 px-s2 py-0.5 text-[11px] font-semibold tracking-wide text-horizon-deep uppercase"
                    >
                      Added by {item.createdByDisplayName}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
