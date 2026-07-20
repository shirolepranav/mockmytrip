import { seededRandom } from "./seed";

/*
 * Deterministic geometric airline marks (TECH_SPEC §5.2).
 * logoFor(logoSeed) returns an SVG string: a simple retro roundel built from
 * a seeded combination of shapes. Colors come from the airline hue so marks
 * stay on-palette without hardcoding brand hex values.
 */

export interface LogoOptions {
  hue: number;
  size?: number;
}

export function logoFor(logoSeed: number, options: LogoOptions): string {
  const { hue, size = 40 } = options;
  const rand = seededRandom(logoSeed);
  const style = Math.floor(rand() * 4);
  const c = size / 2;
  const primary = `hsl(${hue} 62% 42%)`;
  const accent = `hsl(${(hue + 40) % 360} 70% 60%)`;

  let inner = "";
  switch (style) {
    case 0: {
      // Rising-sun bars
      const bars = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < bars; i++) {
        const barHeight = (size / (bars * 2.2)) * (1 + rand() * 0.4);
        const y = c - (i - bars / 2) * (size / (bars + 1)) - barHeight / 2;
        inner += `<rect x="${size * 0.2}" y="${y.toFixed(1)}" width="${(size * 0.6).toFixed(1)}" height="${barHeight.toFixed(1)}" rx="${(barHeight / 2).toFixed(1)}" fill="${i % 2 ? accent : primary}"/>`;
      }
      break;
    }
    case 1: {
      // Delta wing triangle
      const tilt = (rand() * 24 - 12).toFixed(1);
      inner = `<polygon points="${c},${size * 0.16} ${size * 0.82},${size * 0.8} ${size * 0.18},${size * 0.8}" fill="${primary}" transform="rotate(${tilt} ${c} ${c})"/><circle cx="${c}" cy="${(size * 0.62).toFixed(1)}" r="${(size * 0.1).toFixed(1)}" fill="${accent}"/>`;
      break;
    }
    case 2: {
      // Orbit ring + dot
      inner = `<circle cx="${c}" cy="${c}" r="${(size * 0.3).toFixed(1)}" fill="none" stroke="${primary}" stroke-width="${(size * 0.09).toFixed(1)}"/><circle cx="${(c + size * 0.3).toFixed(1)}" cy="${c}" r="${(size * 0.11).toFixed(1)}" fill="${accent}"/>`;
      break;
    }
    default: {
      // Quartered roundel
      inner = `<path d="M ${c} ${c} L ${c} ${size * 0.14} A ${(size * 0.36).toFixed(1)} ${(size * 0.36).toFixed(1)} 0 0 1 ${(size * 0.86).toFixed(1)} ${c} Z" fill="${accent}"/><path d="M ${c} ${c} L ${size * 0.14} ${c} A ${(size * 0.36).toFixed(1)} ${(size * 0.36).toFixed(1)} 0 0 1 ${c} ${size * 0.14} Z" fill="${primary}"/><path d="M ${c} ${c} L ${c} ${(size * 0.86).toFixed(1)} A ${(size * 0.36).toFixed(1)} ${(size * 0.36).toFixed(1)} 0 0 1 ${size * 0.14} ${c} Z" fill="${primary}"/>`;
      break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-hidden="true">${inner}</svg>`;
}
