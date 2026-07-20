import Link from "next/link";

/*
 * Landing page (docs/APP_WORKFLOW.md §1).
 * Kinetic display hero, paper-plane motif, 3-step how-it-works, ethics link.
 * Full kinetic polish lands in Phase 9; the structure and brand land now.
 */

const steps = [
  {
    title: "Dream it",
    body: "Search real airports and pick a trip you'd love — Lisbon in spring, Tokyo in fall, anywhere.",
  },
  {
    title: "Book it (for $0.00)",
    body: "Fictional airlines, synthetic prices, zero payment fields. You get a boarding pass, a stamp, and a countdown.",
  },
  {
    title: "Savor it",
    body: "Plan the itinerary, pack the bag, watch the countdown. The anticipation is the trip.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-s5">
        <section className="flex flex-col items-start gap-s5 pt-[12vh] pb-s8">
          <p className="rounded-pill border border-line bg-paper2 px-s3 py-s1 font-mono text-xs font-semibold tracking-widest text-stamp-red uppercase">
            Simulation — nothing here is real
          </p>
          <h1 className="max-w-[14ch] font-display text-5xl leading-none font-semibold">
            All the thrill.
            <br />
            <span className="text-sunset-deep">None of the jet lag.</span>
          </h1>
          <p className="max-w-prose text-lg text-ink-soft">
            Wanderlost is a pretend travel-booking app for the very real joy of
            planning a trip. Book fake flights, collect passport stamps, and
            live inside the countdown — no cost, no carbon, no card required.
          </p>
          <Link
            href="/welcome"
            className="press-physical inline-flex min-h-12 items-center gap-s2 rounded-pill bg-sunset px-s6 py-s3 text-lg font-semibold text-ink shadow-e2 hover:bg-sunset-deep hover:text-paper2"
          >
            Start dreaming
          </Link>
        </section>

        <section aria-labelledby="how-it-works" className="pb-s8">
          <h2 id="how-it-works" className="font-display text-2xl">
            How it works
          </h2>
          <ol className="mt-s5 grid gap-s4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="ticket-surface relative p-s5"
                style={{
                  transform: `rotate(${(index - 1) * 0.6}deg)`,
                }}
              >
                <span className="font-serif text-3xl text-horizon italic">
                  {index + 1}
                </span>
                <h3 className="mt-s2 font-display text-lg">{step.title}</h3>
                <p className="mt-s2 text-sm text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line py-s5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-s3 px-s5 text-sm text-ink-soft">
          <p>
            Wanderlost is a simulation. No real bookings, ever — just the
            science-backed happiness of looking forward to a trip.
          </p>
          <Link href="/about" className="underline hover:text-ink">
            Why this exists (the ethics &amp; the science)
          </Link>
        </div>
      </footer>
    </div>
  );
}
