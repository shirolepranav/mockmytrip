import { hotelName } from "./names";
import { hashSeed, pick, randInt, seededRandom } from "./seed";

/*
 * Seeded hotel generation (TECH_SPEC §5.2/§5.4). Fictional names, plausible
 * neighborhoods/amenities, nightly price by city cost tier × stars ×
 * seasonality × jitter. Deterministic per city.
 */

export interface HotelOffer {
  id: string;
  name: string;
  city: string;
  country: string;
  stars: 3 | 4 | 5;
  neighborhood: string;
  amenities: string[];
  nightlyCents: number;
  totalCents: number;
  savedCents: number;
  nights: number;
  heroSeed: number;
}

/* Cost tiers by ISO country — high/mid/low nightly bases (USD cents, 3★). */
const HIGH_COST = new Set([
  "CH", "NO", "IS", "DK", "SE", "JP", "US", "GB", "SG", "AU", "NZ", "IE",
  "NL", "FI", "LU", "AE", "QA", "HK", "MO", "IL", "CA", "FR", "AT", "BE",
]);
const LOW_COST = new Set([
  "IN", "VN", "TH", "ID", "PH", "KH", "LA", "NP", "LK", "BD", "PK", "EG",
  "MA", "TN", "BO", "PY", "GT", "HN", "NI", "MX", "CO", "PE", "TR", "AL",
  "RS", "BA", "MK", "GE", "AM", "UZ", "KG",
]);

function nightlyBaseCents(country: string): number {
  if (HIGH_COST.has(country)) return 160_00;
  if (LOW_COST.has(country)) return 55_00;
  return 95_00;
}

const STAR_FACTORS: Record<3 | 4 | 5, number> = { 3: 1, 4: 1.55, 5: 2.6 };

/* Month seasonality for hotels (gentler than flights). */
const MONTH_FACTORS = [
  0.9, 0.88, 0.95, 1.0, 1.05, 1.18, 1.25, 1.22, 1.0, 0.95, 0.9, 1.15,
] as const;

const NEIGHBORHOOD_FLAVORS = [
  "Old Town",
  "Harborfront",
  "Riverside",
  "Garden District",
  "Market Quarter",
  "Arts District",
  "Sunset Quarter",
  "Cathedral Quarter",
  "Lantern District",
  "Seaside Promenade",
  "Clocktower Square",
  "Botanic Quarter",
] as const;

const AMENITY_POOL = [
  "Rooftop terrace",
  "Courtyard pool",
  "Reading room",
  "Bicycle loan",
  "Records & record player",
  "Breakfast till noon",
  "Espresso bar",
  "Hammam",
  "Tiny cinema",
  "Garden bar",
  "Pet friendly",
  "Sauna",
  "Sunset deck",
  "House cats",
  "Board-game library",
] as const;

/** Weighted stars: 3★ 35%, 4★ 45%, 5★ 20%. */
function starsFor(rand: () => number): 3 | 4 | 5 {
  const roll = rand();
  if (roll < 0.35) return 3;
  if (roll < 0.8) return 4;
  return 5;
}

export interface HotelSearchInput {
  city: string;
  country: string;
  /** Check-in date parts (local). */
  year: number;
  month: number; // 1-based
  day: number;
  nights: number;
}

/** 8–20 deterministic hotels for a city, priced for the stay. */
export function hotelsForCity(input: HotelSearchInput): HotelOffer[] {
  const { city, country, year, month, nights } = input;
  const cityKey = city.toLowerCase();
  const cityRand = seededRandom(hashSeed(`hotels:${cityKey}:${country}`));
  const hotelCount = randInt(cityRand, 8, 20);
  const base = nightlyBaseCents(country);

  const offers: HotelOffer[] = [];
  for (let index = 0; index < hotelCount; index++) {
    const rand = seededRandom(hashSeed(`hotel:${cityKey}:${index}`));
    const stars = starsFor(rand);
    const name = hotelName(city, index);
    const neighborhood = pick(rand, NEIGHBORHOOD_FLAVORS);

    const amenityCount = randInt(rand, 3, 6);
    const amenities: string[] = [];
    const poolCopy = [...AMENITY_POOL];
    for (let i = 0; i < amenityCount && poolCopy.length > 0; i++) {
      const j = Math.floor(rand() * poolCopy.length);
      amenities.push(poolCopy.splice(j, 1)[0]);
    }

    // Nightly price: base × stars × seasonality × ±10% jitter per stay date.
    const seasonality = MONTH_FACTORS[month - 1];
    const jitter =
      0.9 + seededRandom(hashSeed(`hjit:${cityKey}:${index}:${year}-${month}`))() * 0.2;
    const nightlyCents = Math.round(
      base * STAR_FACTORS[stars] * seasonality * jitter,
    );
    const totalCents = nightlyCents * nights;

    offers.push({
      id: `H-${hashSeed(`${cityKey}:${index}`).toString(36).toUpperCase()}`,
      name,
      city,
      country,
      stars,
      neighborhood,
      amenities,
      nightlyCents,
      totalCents,
      savedCents: totalCents,
      nights,
      heroSeed: hashSeed(`hero:${cityKey}:${index}`),
    });
  }

  return offers;
}
