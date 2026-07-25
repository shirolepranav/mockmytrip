import { readSessionUserId } from "@/lib/auth/session";
import { getPassportSummary, listStampsForUser } from "@/lib/services/trips";
import { formatDateInTz, formatMoney, kmToMiles } from "@/lib/format";
import { StampGrid, type StampCardData } from "@/components/stamp-grid";
import { PassportEffects } from "@/components/passport-effects";

/*
 * Virtual passport (WF §16): PassportCover-style stat header + StampGrid,
 * counts (countries, cities, miles dreamed), savings total. A fresh stamp
 * arriving from a booking (`?justStamped=<id>`) gets the entrance animation;
 * every other stamp (and this stamp on a later revisit) renders settled.
 */

export const metadata = { title: "Passport" };

export default async function PassportPage({
  searchParams,
}: {
  searchParams: Promise<{ justStamped?: string }>;
}) {
  const { justStamped } = await searchParams;
  const userId = await readSessionUserId();

  const stamps = userId ? await listStampsForUser(userId) : [];
  const summary = userId
    ? await getPassportSummary(userId)
    : { countryCount: 0, cityCount: 0, totalDistanceKm: 0, savingsCents: 0 };

  if (stamps.length === 0) {
    return (
      <section className="flex flex-col items-start gap-s3">
        <h1 className="font-display text-2xl">Your first stamp awaits</h1>
        <p className="max-w-prose text-ink-soft">
          Every pretend booking earns a very real-looking stamp. Book a trip
          to start your collection.
        </p>
      </section>
    );
  }

  const stampCards: StampCardData[] = stamps.map((stamp) => ({
    id: stamp.id,
    stampStyle: stamp.stampStyle,
    rotationDeg: stamp.rotationDeg,
    inkHue: stamp.inkHue,
    city: stamp.city,
    countryIso: stamp.countryIso,
    dateLabel: formatDateInTz(stamp.stampDate.getTime(), "UTC"),
  }));

  return (
    <section className="flex flex-col gap-s6">
      <PassportEffects />
      <header className="flex flex-col gap-s3">
        <h1 className="font-display text-2xl">Passport</h1>
        <div
          data-testid="passport-summary"
          className="ticket-surface flex flex-wrap gap-s6 p-s4"
        >
          <Stat label="Countries" value={summary.countryCount} />
          <Stat label="Cities" value={summary.cityCount} />
          <Stat
            label="Miles dreamed"
            value={kmToMiles(summary.totalDistanceKm).toLocaleString()}
          />
          <Stat label="Saved" value={formatMoney(summary.savingsCents)} />
        </div>
      </header>

      <StampGrid stamps={stampCards} justStampedId={justStamped} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-lg font-bold">{value}</span>
      <span className="text-xs tracking-wide text-ink-soft uppercase">
        {label}
      </span>
    </div>
  );
}
