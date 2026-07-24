import { FlightSearchForm } from "@/components/flight-search-form";

/*
 * Flight search (WF §3): the core entry point. Popular-destination
 * suggestions keep the empty state warm.
 */

export const metadata = { title: "Search flights" };

export default async function FlightSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-s5">
      <header>
        <h1 className="font-display text-3xl">Where to?</h1>
        <p className="mt-s2 text-ink-soft">
          Real airports, pretend flights. Pick anywhere — it&apos;s all
          $0.00.
        </p>
      </header>

      {params.notice === "need-flight" ? (
        <p
          role="alert"
          className="rounded-card border border-alert bg-paper2 px-s4 py-s3 text-alert"
        >
          Pick a flight first — hotels and your trip summary need a flight
          to anchor the dates.
        </p>
      ) : null}

      <FlightSearchForm
        initial={{
          origin: params.o,
          destination: params.d,
          departDate: params.depart,
          returnDate: params.return,
          passengers: params.pax ? Number(params.pax) : undefined,
          cabin: params.cabin,
        }}
      />
    </section>
  );
}
