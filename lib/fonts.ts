import localFont from "next/font/local";

/*
 * Self-hosted variable fonts (docs/DESIGN_SYSTEM.md §4).
 * Display: Clash Display (fallback Bricolage Grotesque) — NEVER Inter/system.
 * Serif accent: Fraunces. Body: Hanken Grotesk. Mono: Martian Mono.
 */

export const clashDisplay = localFont({
  src: "../app/fonts/ClashDisplay-Variable.woff2",
  variable: "--font-clash",
  weight: "200 700",
  display: "swap",
});

export const bricolage = localFont({
  src: "../app/fonts/BricolageGrotesque-Variable.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

export const fraunces = localFont({
  src: [
    {
      path: "../app/fonts/Fraunces-Variable.woff2",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "../app/fonts/Fraunces-VariableItalic.woff2",
      style: "italic",
      weight: "100 900",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

export const hankenGrotesk = localFont({
  src: "../app/fonts/HankenGrotesk-Variable.woff2",
  variable: "--font-hanken",
  weight: "100 900",
  display: "swap",
});

export const martianMono = localFont({
  src: "../app/fonts/MartianMono-Variable.woff2",
  variable: "--font-martian",
  weight: "100 800",
  display: "swap",
});

/** All font CSS-variable classes, joined for the <html> element. */
export const fontVariables = [
  clashDisplay.variable,
  bricolage.variable,
  fraunces.variable,
  hankenGrotesk.variable,
  martianMono.variable,
].join(" ");
