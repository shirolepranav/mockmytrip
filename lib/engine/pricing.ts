import { hashSeed, seededRandom } from "./seed";

/*
 * Synthetic pricing (TECH_SPEC §5.4). All money is fake and labeled simulated.
 * final = base(distance) × month × day-of-week × days-until × cabin × jitter,
 * with a $39 economy floor. "You saved" = the full synthetic price, since the
 * user always pays $0.00.
 */

export type Cabin = "economy" | "premium" | "business" | "first";

export const CABIN_MULTIPLIERS: Record<Cabin, number> = {
  economy: 1.0,
  premium: 1.6,
  business: 3.2,
  first: 5.5,
};

const PRICE_FLOOR_CENTS = 39_00;

/** Per-km rate (USD) decreasing with distance band. */
export function baseFarePerKm(distanceKmValue: number): number {
  if (distanceKmValue < 1_500) return 0.22;
  if (distanceKmValue < 4_000) return 0.14;
  if (distanceKmValue < 9_000) return 0.09;
  return 0.07;
}

/* Month seasonality: northern-summer + December peaks. */
const MONTH_FACTORS = [
  0.88, 0.85, 0.95, 1.0, 1.05, 1.25, 1.35, 1.3, 1.0, 0.95, 0.9, 1.3,
] as const;

/** Day-of-week factor: Fri/Sun peak, midweek dip. */
export function dayOfWeekFactor(utcDay: number): number {
  switch (utcDay) {
    case 5: // Fri
    case 0: // Sun
      return 1.15;
    case 2: // Tue
    case 3: // Wed
      return 0.92;
    default:
      return 1.0;
  }
}

/** Booking curve: closer departures cost more (range ~0.85–1.55). */
export function daysUntilFactor(daysUntil: number): number {
  if (daysUntil <= 1) return 1.55;
  if (daysUntil <= 3) return 1.45;
  if (daysUntil <= 7) return 1.3;
  if (daysUntil <= 14) return 1.15;
  if (daysUntil <= 30) return 1.0;
  if (daysUntil <= 60) return 0.95;
  if (daysUntil <= 120) return 0.9;
  return 0.85;
}

export interface PriceQuery {
  distanceKm: number;
  departUtcMs: number;
  cabin: Cabin;
  /** Uniqueness key for jitter, e.g. `${route}:${date}:${flightNumber}`. */
  jitterKey: string;
  /** "Now" for the booking curve — injectable for deterministic tests. */
  nowMs?: number;
}

export interface PriceResult {
  priceCents: number;
  /** Full synthetic price — what the user "saves" by paying $0.00. */
  savedCents: number;
}

export function priceFlight(query: PriceQuery): PriceResult {
  const { distanceKm: d, departUtcMs, cabin, jitterKey } = query;
  const nowMs = query.nowMs ?? Date.now();

  const base = Math.max(baseFarePerKm(d) * d, PRICE_FLOOR_CENTS / 100);

  const depart = new Date(departUtcMs);
  const month = MONTH_FACTORS[depart.getUTCMonth()];
  const dow = dayOfWeekFactor(depart.getUTCDay());
  const daysUntil = Math.max(
    0,
    Math.floor((departUtcMs - nowMs) / 86_400_000),
  );
  const curve = daysUntilFactor(daysUntil);

  // Deterministic ±8% jitter, stable per flight within a search.
  const jitter = 0.92 + seededRandom(hashSeed(`jitter:${jitterKey}`))() * 0.16;

  const dollars = base * month * dow * curve * CABIN_MULTIPLIERS[cabin] * jitter;
  const priceCents = Math.max(
    Math.round(dollars * 100),
    Math.round(PRICE_FLOOR_CENTS * CABIN_MULTIPLIERS[cabin]),
  );

  return { priceCents, savedCents: priceCents };
}
