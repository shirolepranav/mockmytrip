import { seededRandom } from "./seed";

/*
 * Seeded destination hero art (Phase 4 task 4, TECH_SPEC/DESIGN_SYSTEM §6):
 * procedural, flat retro-poster SVG scenes — no stock photos, no real geo
 * lookup. There's no biome/coastal metadata anywhere in the airport seed, so
 * the skyline/beach/mountain template is a seeded aesthetic pick (same
 * technique as logo.ts's style switch), not a geography lookup. Reused for
 * hotel hero art (keyed on `heroSeed`) and later for real trip covers (keyed
 * on `cover_seed`) once a trip row exists.
 */

export interface DestinationArtOptions {
  size?: number;
}

function skyGradientId(seed: number): string {
  return `wl-sky-${seed}`;
}

function skyline(rand: () => number, seed: number, w: number, h: number): string {
  const skyHue = 20 + rand() * 40; // sunset range
  const gradientId = skyGradientId(seed);
  const buildingCount = 5 + Math.floor(rand() * 4);
  let buildings = "";
  const buildingWidth = w / buildingCount;
  for (let i = 0; i < buildingCount; i++) {
    const bh = h * (0.3 + rand() * 0.45);
    const bx = i * buildingWidth;
    const hue = (skyHue + 180 + rand() * 30) % 360;
    buildings += `<rect x="${bx.toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${(buildingWidth * 0.82).toFixed(1)}" height="${bh.toFixed(1)}" fill="hsl(${hue.toFixed(0)} 30% 20%)"/>`;
    const windowRows = Math.floor(bh / 14);
    for (let r = 0; r < windowRows; r++) {
      if (rand() > 0.55) continue;
      const wy = h - bh + 6 + r * 14;
      buildings += `<rect x="${(bx + buildingWidth * 0.18).toFixed(1)}" y="${wy.toFixed(1)}" width="${(buildingWidth * 0.16).toFixed(1)}" height="6" fill="hsl(${(skyHue + 30).toFixed(0)} 80% 70%)" opacity="0.8"/>`;
    }
  }
  return `<rect width="${w}" height="${h}" fill="url(#${gradientId})"/>
    <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${skyHue.toFixed(0)} 70% 55%)"/>
      <stop offset="100%" stop-color="hsl(${(skyHue + 20).toFixed(0)} 80% 75%)"/>
    </linearGradient></defs>
    <circle cx="${(w * 0.78).toFixed(1)}" cy="${(h * 0.28).toFixed(1)}" r="${(h * 0.12).toFixed(1)}" fill="hsl(${(skyHue + 15).toFixed(0)} 85% 82%)"/>
    ${buildings}`;
}

function beach(rand: () => number, seed: number, w: number, h: number): string {
  const skyHue = 190 + rand() * 30;
  const gradientId = skyGradientId(seed);
  const waterLine = h * (0.55 + rand() * 0.08);
  const sandLine = h * (0.78 + rand() * 0.06);
  const palmX = w * (0.14 + rand() * 0.14);
  const palmHue = 95 + rand() * 25;
  return `<rect width="${w}" height="${h}" fill="url(#${gradientId})"/>
    <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${skyHue.toFixed(0)} 70% 78%)"/>
      <stop offset="100%" stop-color="hsl(${(skyHue - 20).toFixed(0)} 60% 88%)"/>
    </linearGradient></defs>
    <rect y="${waterLine.toFixed(1)}" width="${w}" height="${(sandLine - waterLine).toFixed(1)}" fill="hsl(${(skyHue + 10).toFixed(0)} 55% 55%)"/>
    <rect y="${sandLine.toFixed(1)}" width="${w}" height="${(h - sandLine).toFixed(1)}" fill="hsl(38 55% 78%)"/>
    <rect x="${palmX.toFixed(1)}" y="${(sandLine - h * 0.32).toFixed(1)}" width="${(w * 0.03).toFixed(1)}" height="${(h * 0.32).toFixed(1)}" fill="hsl(28 35% 30%)"/>
    <ellipse cx="${palmX.toFixed(1)}" cy="${(sandLine - h * 0.32).toFixed(1)}" rx="${(w * 0.14).toFixed(1)}" ry="${(h * 0.08).toFixed(1)}" fill="hsl(${palmHue.toFixed(0)} 45% 35%)"/>
    <circle cx="${(w * 0.72).toFixed(1)}" cy="${(h * 0.22).toFixed(1)}" r="${(h * 0.1).toFixed(1)}" fill="hsl(45 85% 78%)"/>`;
}

function mountain(rand: () => number, seed: number, w: number, h: number): string {
  const skyHue = 205 + rand() * 25;
  const gradientId = skyGradientId(seed);
  const ridgeCount = 3;
  let ridges = "";
  for (let i = 0; i < ridgeCount; i++) {
    const baseY = h * (0.5 + i * 0.16);
    const peakY = baseY - h * (0.18 - i * 0.03) * (0.6 + rand() * 0.4);
    const shade = 30 - i * 6 + rand() * 5;
    ridges += `<polygon points="0,${h} 0,${baseY.toFixed(1)} ${(w * 0.35).toFixed(1)},${peakY.toFixed(1)} ${(w * 0.62).toFixed(1)},${(baseY - h * 0.05).toFixed(1)} ${w},${peakY.toFixed(1)} ${w},${h}" fill="hsl(${skyHue.toFixed(0)} 25% ${shade.toFixed(0)}%)"/>`;
  }
  return `<rect width="${w}" height="${h}" fill="url(#${gradientId})"/>
    <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${skyHue.toFixed(0)} 60% 60%)"/>
      <stop offset="100%" stop-color="hsl(${(skyHue + 30).toFixed(0)} 70% 82%)"/>
    </linearGradient></defs>
    <circle cx="${(w * 0.24).toFixed(1)}" cy="${(h * 0.22).toFixed(1)}" r="${(h * 0.09).toFixed(1)}" fill="hsl(48 80% 85%)"/>
    ${ridges}`;
}

/** Deterministic, flat retro-poster destination scene as an SVG string. */
export function destinationArtFor(
  seed: number,
  options: DestinationArtOptions = {},
): string {
  const { size = 320 } = options;
  const w = size;
  const h = Math.round(size * 0.6);
  const rand = seededRandom(seed);
  const template = Math.floor(rand() * 3);
  const inner =
    template === 0
      ? skyline(rand, seed, w, h)
      : template === 1
        ? beach(rand, seed, w, h)
        : mountain(rand, seed, w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-hidden="true">${inner}</svg>`;
}

export interface MapSketchOptions {
  size?: number;
}

/** Abstract, clearly-not-real street-grid sketch for the hotel "map" placeholder. */
export function mapSketchFor(
  seed: number,
  options: MapSketchOptions = {},
): string {
  const { size = 240 } = options;
  const rand = seededRandom(seed);
  const hue = 30 + rand() * 30;
  let streets = "";
  const lines = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < lines; i++) {
    const y = (size / (lines + 1)) * (i + 1);
    streets += `<line x1="0" y1="${y.toFixed(1)}" x2="${size}" y2="${y.toFixed(1)}" stroke="hsl(${hue.toFixed(0)} 20% 70%)" stroke-width="3"/>`;
  }
  for (let i = 0; i < lines; i++) {
    const x = (size / (lines + 1)) * (i + 1);
    streets += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${size}" stroke="hsl(${hue.toFixed(0)} 20% 70%)" stroke-width="3"/>`;
  }
  const pinX = size * (0.4 + rand() * 0.2);
  const pinY = size * (0.4 + rand() * 0.2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-hidden="true">
    <rect width="${size}" height="${size}" fill="hsl(${hue.toFixed(0)} 30% 92%)"/>
    ${streets}
    <circle cx="${pinX.toFixed(1)}" cy="${pinY.toFixed(1)}" r="10" fill="hsl(6 70% 55%)"/>
    <circle cx="${pinX.toFixed(1)}" cy="${pinY.toFixed(1)}" r="4" fill="hsl(0 0% 100%)"/>
  </svg>`;
}
