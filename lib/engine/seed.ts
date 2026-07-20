/*
 * Determinism core (TECH_SPEC §5.5). One normalized query → one seed →
 * one PRNG stream, so results are identical across SSR, hydration, and
 * repeat searches.
 */

/** cyrb53 — fast 53-bit string hash, well distributed. */
export function hashSeed(input: string, salt = 0): number {
  let h1 = 0xdeadbeef ^ salt;
  let h2 = 0x41c6ce57 ^ salt;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 — tiny seeded PRNG returning floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normalize arbitrary query params into a stable seed. */
export function querySeed(params: Record<string, unknown>): number {
  const normalized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key]).trim().toLowerCase()}`)
    .join("&");
  return hashSeed(normalized);
}

/** Integer in [min, max] inclusive from a PRNG stream. */
export function randInt(
  rand: () => number,
  min: number,
  max: number,
): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Pick one element deterministically. */
export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}
