import blocklist from "@/data/brand-blocklist.json";
import { hashSeed, pick, seededRandom } from "./seed";

/*
 * Fictional airline & hotel names (TECH_SPEC §5.2, golden rule #4).
 * ~40 curated airlines and a combinatorial hotel-name generator; EVERY
 * generated name passes through assertNotRealBrand before leaving the engine.
 */

export interface Airline {
  name: string;
  code: string; // fictional 2-char code
  hue: number; // brand hue 0–360 for the generated logo
  logoSeed: number;
}

const BLOCKED: string[] = [...blocklist.airlines, ...blocklist.hotels];

export class RealBrandError extends Error {
  constructor(name: string, match: string) {
    super(`Generated name "${name}" collides with real brand "${match}"`);
    this.name = "RealBrandError";
  }
}

/** Throws when a generated name contains a real-brand substring. */
export function assertNotRealBrand(name: string): string {
  const lower = ` ${name.toLowerCase()} `;
  for (const brand of BLOCKED) {
    if (lower.includes(brand)) throw new RealBrandError(name, brand);
  }
  return name;
}

/* Curated fleet: plausible-but-fictional, retro-flavored. Codes avoid
   well-known real IATA codes. */
const AIRLINE_SEED: ReadonlyArray<[string, string, number]> = [
  ["Altair Airways", "A7", 24],
  ["Meridian Pacific", "MP", 205],
  ["Lumen Air", "LM", 45],
  ["Cirrus Continental", "C6", 210],
  ["Vela Airlines", "VX", 268],
  ["Nimbus Skyways", "NM", 197],
  ["Solstice Air", "SL", 36],
  ["Halcyon Airlines", "HN", 174],
  ["Aurora Transcontinental", "AZ", 289],
  ["Zephyr Jet", "ZJ", 152],
  ["Borealis Air", "BX", 231],
  ["Cascadia Wings", "CD", 141],
  ["Isla Corriente Air", "IZ", 192],
  ["Monsoon Air", "MO", 222],
  ["Sierra Skyline", "S9", 19],
  ["Tradewind Aeronautic", "T4", 184],
  ["Pelican Pacific", "P7", 200],
  ["Caravel Air", "CB", 14],
  ["Drift Airways", "DR", 168],
  ["Ember Air", "EB", 8],
  ["Fable Air", "F2", 260],
  ["Golden Parallel", "GP", 43],
  ["Haven Air", "HW", 158],
  ["Ionosphere Airways", "IO", 240],
  ["Juniper Jet", "JR", 118],
  ["Kite & Compass Air", "KP", 30],
  ["Latitude Loop", "L7", 178],
  ["Marlin Air", "MR", 203],
  ["Northlight Air", "N4", 215],
  ["Opaline Airways", "OQ", 285],
  ["Prism Pacific", "PZ", 310],
  ["Quill Air", "Q7", 55],
  ["Rambler Air", "RM", 21],
  ["Saffron Skies", "SB", 33],
  ["Tessera Air", "TE", 250],
  ["Umbra Air", "UB", 275],
  ["Verdant Air", "VG", 130],
  ["Wayfare Air", "WY", 27],
  ["Yonder Airlines", "YD", 190],
  ["Postcard Air", "PT", 12],
] as const;

export const AIRLINES: readonly Airline[] = AIRLINE_SEED.map(
  ([name, code, hue]) => ({
    name: assertNotRealBrand(name),
    code,
    hue,
    logoSeed: hashSeed(`logo:${code}:${name}`),
  }),
);

/** Deterministically assign an airline to a route+index. */
export function airlineFor(routeKey: string, index: number): Airline {
  const rand = seededRandom(hashSeed(`airline:${routeKey}:${index}`));
  return pick(rand, AIRLINES);
}

/* Hotel name banks: [Prefix] + [Core] + [Type]. */
const HOTEL_PREFIXES = [
  "The",
  "Grand",
  "Maison",
  "Casa",
  "Hotel",
  "Villa",
  "The Little",
  "Port",
] as const;

const HOTEL_CORES = [
  "Meridian",
  "Lantern",
  "Harborlight",
  "Cypress",
  "Verandah",
  "Compass Rose",
  "Tidewater",
  "Marigold",
  "Cobalt",
  "Terrace",
  "Bellflower",
  "Driftwood",
  "Magnolia",
  "Nutmeg",
  "Olive Grove",
  "Palmline",
  "Quayside",
  "Sundial",
  "Tamarind",
  "Wisteria",
  "Cartographer's",
  "Postmark",
  "Signal House",
  "Aerie",
  "Half Moon",
  "Paper Crane",
  "Saltair",
  "Ledger",
  "Gilded Fig",
  "Blue Shutter",
] as const;

const HOTEL_TYPES = [
  "Hotel",
  "Residence",
  "Suites",
  "Lodge",
  "Inn",
  "House",
  "Collection",
  "Court",
] as const;

/** Seeded fictional hotel name for a city + index. */
export function hotelName(city: string, index: number): string {
  const rand = seededRandom(hashSeed(`hotel:${city.toLowerCase()}:${index}`));
  // Try a few combinations in the (unlikely) event of a blocklist collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const prefix = pick(rand, HOTEL_PREFIXES);
    const core = pick(rand, HOTEL_CORES);
    const type = pick(rand, HOTEL_TYPES);
    const name =
      prefix === "Hotel" ? `Hotel ${core}` : `${prefix} ${core} ${type}`;
    try {
      return assertNotRealBrand(name);
    } catch {
      continue;
    }
  }
  // Word banks are curated; reaching here would mean the banks themselves
  // collide with a brand — fail loudly rather than emit a real name.
  throw new RealBrandError(`${city}:${index}`, "unresolvable");
}
