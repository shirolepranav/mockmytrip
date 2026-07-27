import Link from "next/link";

/*
 * Privacy Policy (Phase 10 launch-readiness gap). Same ticket-surface
 * structure/tone as app/(app)/about/page.tsx — static content, no data
 * fetching. Every claim here must stay true to what the codebase actually
 * does; update this page in the same change as anything that changes what
 * data is collected or which subprocessors are used.
 */

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-s6">
      <header className="flex flex-col gap-s2">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          SIMULATION, always
        </p>
        <h1 className="font-display text-2xl">Privacy Policy</h1>
        <p className="text-sm text-ink-soft">
          Wanderlost is a pretend travel-booking app. This page explains,
          plainly, what little data it actually collects and why.
        </p>
      </header>

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">What we collect</h2>
        <p className="text-sm text-ink-soft">
          An optional email address (only if you choose to add one, so you
          can sign back in from another device), and whatever trip content
          you create — searches, pretend bookings, itinerary notes, packing
          lists, memories. Never a real name, address, or payment detail:
          there is no card field or payment SDK anywhere in this app,
          because nothing is ever actually purchased.
        </p>
      </div>

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">Cookies</h2>
        <p className="text-sm text-ink-soft">
          A single first-party cookie, <code>wl_session</code>, identifies
          your guest or signed-in session. It&apos;s httpOnly (JavaScript
          can&apos;t read it) and signed, and lasts about 13 months. That is
          the only cookie this app sets — no third-party tracking or
          advertising cookies, and no fingerprinting.
        </p>
      </div>

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">Who processes your data</h2>
        <ul className="flex flex-col gap-s2 text-sm text-ink-soft">
          <li>
            <strong className="text-ink">Neon</strong> — hosts the Postgres
            database your trips live in.
          </li>
          <li>
            <strong className="text-ink">Vercel</strong> — hosts and serves
            the app.
          </li>
          <li>
            <strong className="text-ink">Resend</strong> — sends the
            optional booking-confirmation email, only if you&apos;ve added
            an email address.
          </li>
          <li>
            <strong className="text-ink">Anthropic</strong> — powers the
            optional &ldquo;AI suggest itinerary&rdquo; feature. Only the
            trip details needed for a suggestion are sent, only when you ask
            for one; the feature simply doesn&apos;t appear if this
            isn&apos;t configured.
          </li>
          <li>
            <strong className="text-ink">Sentry</strong> — receives crash
            and error reports so bugs can be fixed. No session replay, no
            behavior analytics, no advertising — error reports are stripped
            of cookies and personal identifiers before they&apos;re sent.
          </li>
        </ul>
        <p className="text-sm text-ink-soft">
          Nobody on this list receives your data for advertising, and
          nothing here is ever sold.
        </p>
      </div>

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">Retention &amp; your control</h2>
        <p className="text-sm text-ink-soft">
          You can export everything you&apos;ve created as a JSON file, or
          permanently delete it, at any time — both take effect immediately,
          no waiting period, no &ldquo;are you sure&rdquo; dark patterns.
        </p>
        <Link
          href="/settings"
          className="press-physical inline-flex min-h-11 w-fit items-center rounded-pill border border-line px-s5 font-semibold text-ink"
        >
          Go to Settings
        </Link>
      </div>

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">No ads, no dark patterns</h2>
        <p className="text-sm text-ink-soft">
          There are no ads, no affiliate links, and no third-party trackers
          in this app. See{" "}
          <Link href="/about" className="font-semibold text-horizon-deep underline">
            About &amp; Ethics
          </Link>{" "}
          for the full pledge.
        </p>
      </div>

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">Questions</h2>
        <p className="text-sm text-ink-soft">
          Reach out any time at{" "}
          <a
            href="mailto:hello@wanderlost.app"
            className="font-semibold text-horizon-deep underline"
          >
            hello@wanderlost.app
          </a>
          .
        </p>
      </div>
    </section>
  );
}
