import { readSessionUserId } from "@/lib/auth/session";
import { getPassportSummary } from "@/lib/services/trips";
import { getUser } from "@/lib/services/users";
import { PassportView } from "@/components/passport-view";
import type { StampCardData } from "@/components/stamp-card";
import { formatDateInTz } from "@/lib/format";

/* Virtual passport (WF §16, Phase 6 task 7) — replaces the Phase 5 stub. */

export const metadata = { title: "Passport" };

export default async function PassportPage({
  searchParams,
}: {
  searchParams: Promise<{ justStamped?: string }>;
}) {
  const [userId, search] = await Promise.all([readSessionUserId(), searchParams]);

  if (!userId) {
    return (
      <PassportView
        stamps={[]}
        countryCount={0}
        cityCount={0}
        totalDistanceKm={0}
        savingsCents={0}
      />
    );
  }

  const [summary, user] = await Promise.all([
    getPassportSummary(userId),
    getUser(userId),
  ]);

  // Stamps have no IATA/tz column of their own (and after a trip delete,
  // no flight to join back to for one — tripId goes null), so the date
  // label is formatted in a fixed zone. That keeps a stamp's rendered text
  // identical before and after its trip is deleted (QA 6.7).
  const cards: StampCardData[] = summary.stamps.map((stamp) => ({
    id: stamp.id,
    city: stamp.city,
    countryIso: stamp.countryIso,
    stampStyle: stamp.stampStyle,
    rotationDeg: stamp.rotationDeg,
    inkHue: stamp.inkHue,
    dateLabel: formatDateInTz(stamp.stampDate.getTime(), "UTC"),
    distanceKm: stamp.distanceKm,
    tripId: stamp.tripId,
  }));

  // listStamps orders newest-first, so index 0 is the just-earned stamp.
  const entranceStampId =
    search.justStamped === "1" ? cards[0]?.id : undefined;

  return (
    <PassportView
      stamps={cards}
      countryCount={summary.countryCount}
      cityCount={summary.cityCount}
      totalDistanceKm={summary.totalDistanceKm}
      savingsCents={user?.totalSavedCents ?? 0}
      entranceStampId={entranceStampId}
    />
  );
}
