import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { readSessionUserId } from "@/lib/auth/session";
import { resolveAccess } from "@/lib/services/access";
import { getSharedTripView, hashLookupIp, recordShareLookup } from "@/lib/services/shares";
import { OwnershipError } from "@/lib/services/ownership";
import { tripLengthDays } from "@/lib/services/itinerary";
import { formatDateInTz } from "@/lib/format";
import { joinSharedTripAction } from "@/actions/shares";
import { DestinationArt } from "@/components/destination-art";
import { SimulationBadge } from "@/components/simulation-badge";
import { SharedItineraryList } from "@/components/shared-itinerary-list";
import { AddToCalendarButton } from "@/components/add-to-calendar-button";

/*
 * Public shared trip page (WF §20c, TECH_SPEC §8b.1). NOT nested under
 * (app)/layout.tsx — same pattern as (marketing)/(onboarding) — so there's
 * no bottom-tab-bar/top-nav chrome here; this is a standalone public page,
 * reachable with zero session (auth is TOKEN POSSESSION, not identity).
 *
 * Revoked, expired, and trip-deleted all collapse to the same "tucked
 * away" state (WF §20c) — the visitor never learns which case it was.
 *
 * No response caching here (originally planned as an `unstable_cache`-
 * wrapped read with a 60s ceiling — TECH_SPEC's "≤60s" framing anticipates
 * that): the IP rate-limit check already needs `headers()`, which forces
 * this route fully dynamic regardless, and the installed Next.js version's
 * cache-invalidation primitives (`revalidateTag` now requires a cache
 * "profile" argument for the newer `"use cache"` system) don't cleanly
 * apply to `unstable_cache` tags. A live read on every request is simpler,
 * avoids depending on that still-moving API, and gives a strictly better
 * guarantee than the spec asks for — revocation is immediate, not
 * "within 60s" — at a negligible DB cost for a low-traffic page.
 */

export const metadata = { title: "A shared trip" };

async function resolveVisitorIpHash(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  return hashLookupIp(ip);
}

export default async function SharedTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ joined?: string }>;
}) {
  const { token } = await params;
  const { joined } = await searchParams;

  // Rate-limit + view-count bookkeeping runs on every request, uncached —
  // this is the part that legitimately needs the dynamic `headers()` call,
  // so it's kept separate from the 60s-cached trip/itinerary read below.
  // A rate-limited or otherwise gone token both render the same friendly
  // state — never distinguishable to the visitor.
  const ipHash = await resolveVisitorIpHash();
  const { allowed } = await recordShareLookup(token, ipHash);
  const view = allowed ? await getSharedTripView(token) : null;
  if (!view) {
    return <GoneState />;
  }

  // A session user who already has their own relationship to this trip
  // (owner, or already a collaborator) skips the public preview entirely.
  const userId = await readSessionUserId();
  if (userId) {
    try {
      const access = await resolveAccess(userId, view.tripId);
      redirect(
        access.role === "owner"
          ? `/trips/${access.trip.id}`
          : `/trips/${access.trip.id}/itinerary`,
      );
    } catch (error) {
      if (!(error instanceof OwnershipError)) throw error;
      // Not yet related to this trip — fall through to the public preview.
    }
  }

  const dayCount = tripLengthDays(view.trip);
  const canJoin = view.permission === "edit";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-s6 p-s4 sm:p-s6">
      <SimulationBadge />

      <p
        data-testid="shared-simulation-banner"
        className="ticket-surface px-s4 py-s3 text-sm font-semibold text-stamp-red"
      >
        This is a dream trip — nothing here is booked or paid for.
      </p>

      <DestinationArt
        seed={view.trip.coverSeed}
        size={640}
        className="aspect-[16/9] w-full rounded-lg"
      />

      <header className="flex flex-col gap-s2">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          {view.trip.destinationCity}
          {view.trip.destinationCountry ? `, ${view.trip.destinationCountry}` : ""}
        </p>
        <h1 className="font-display text-3xl">
          {view.ownerDisplayName ? `${view.ownerDisplayName}'s ` : ""}
          {view.trip.title}
        </h1>
        <p className="text-sm text-ink-soft">
          {formatDateInTz(view.trip.startDate.getTime(), "UTC")} –{" "}
          {formatDateInTz(view.trip.endDate.getTime(), "UTC")}
        </p>
      </header>

      {joined === "gone" ? (
        <p role="alert" className="rounded-card border border-alert bg-paper2 px-s4 py-s3 text-alert">
          This link isn&apos;t active anymore — the owner may have revoked it.
        </p>
      ) : null}
      {joined === "view-only" ? (
        <p role="alert" className="rounded-card border border-alert bg-paper2 px-s4 py-s3 text-alert">
          This is a view-only link — the owner hasn&apos;t turned on collaborative editing.
        </p>
      ) : null}

      <SharedItineraryList items={view.items} dayCount={dayCount} />

      <div className="flex flex-wrap items-center gap-s3">
        {canJoin ? (
          <form action={joinSharedTripAction.bind(null, token)}>
            <button
              type="submit"
              data-testid="join-shared-trip-button"
              className="press-physical inline-flex min-h-11 items-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
            >
              Add your ideas
            </button>
          </form>
        ) : null}
        <AddToCalendarButton tripId={view.tripId} token={token} />
        <Link
          href="/welcome"
          className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
        >
          Make your own
        </Link>
      </div>
    </main>
  );
}

function GoneState() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-s5 p-s6 text-center">
      <SimulationBadge />
      <h1 className="font-display text-2xl">This dream has been tucked away</h1>
      <p className="text-ink-soft">
        This link is no longer active — it may have been revoked, or the trip may no
        longer exist.
      </p>
      <Link
        href="/welcome"
        className="press-physical inline-flex min-h-11 items-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
      >
        Start your own dream trip
      </Link>
    </main>
  );
}
