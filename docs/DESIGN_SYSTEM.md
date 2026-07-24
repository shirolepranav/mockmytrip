# WANDERLOST — Design System

> Companion docs: `PRD.md`, `TECH_SPEC.md`, `APP_WORKFLOW.md`. Enforced by `.claude/skills/design-system` and `.claude/skills/playful-animations`.

## 1. Brand Personality & Name
**Personality:** warm, witty, wondrous, a little retro-analog — a beloved 1970s airline crossed with a friendly travel journal and a pinch of theme-park magic. Self-aware and honest (it knows it's a dream), never cynical. Tactile and physical, not glassy/generic.

**Name (recommended): Wanderlost.** Alternatives: *Layover, Faraway, Terminal Bliss, Almost There, Departures.*

**Tagline:** "All the thrill. None of the jet lag."

## 2. Anti-Vibe-Code Rules (READ FIRST — hard rules)
The single biggest failure mode for AI-built sites is "distributional convergence" — every generated site defaults to the same Inter font, purple-to-blue gradient, and uniform 16px rounded cards. Wanderlost bans those defaults outright.

Do **NOT** ship any of:
1. ❌ Inter, Roboto, Arial, system-ui, or Space Grotesk as the display face. Use the specified characterful fonts.
2. ❌ Purple→blue gradient (on white or otherwise). ❌ Generic "indigo/violet SaaS" palette.
3. ❌ Default shadcn/ui look (uniform 16px radius, muted zinc palette, stock Card/Button). If a Radix/shadcn primitive is used for a11y scaffolding, it MUST be fully restyled with our tokens.
4. ❌ Emoji as UI icons (no 🛫 as a button). Use the custom icon set / restyled Lucide.
5. ❌ Three identical rounded cards in a row as the hero.
6. ❌ Stock photography or generic AI hero images. Use procedural/illustrative art.
7. ❌ Timid, evenly-distributed pastel palettes. Commit to a dominant color + sharp accent.
8. ✅ DO: one distinctive display font used decisively; a committed retro-travel palette; mixed radii (some sharp, some pill); physical depth via layered *flat* shadows and ticket-stub die-cuts (not blurry drop shadows); kinetic type moments; boarding-pass/departure-board metaphors throughout.

## 3. Color Palette (exact hex)
A sun-faded, retro-travel-poster identity — warm paper base, deep aviation ink, bright "stamp" accent. Deliberately NOT purple/indigo.

**Core**
- `--ink` (primary text / deep aviation navy): `#122A3A`
- `--paper` (app background, warm off-white): `#F6EEDF`
- `--paper-2` (raised surfaces): `#FBF6EC`
- `--ink-soft` (secondary text): `#3E5566`

**Brand**
- `--sunset` (primary accent — retro orange): `#F4713B`
- `--sunset-deep` (pressed/hover): `#D6521F`
- `--horizon` (secondary — teal): `#177E7E`
- `--horizon-deep`: `#0F5C5C`
- `--sky` (tertiary, soft): `#9CC6D0`

**Support / stamps**
- `--stamp-red` (passport ink): `#C4362E`
- `--stamp-violet` (a single, non-gradient accent for special stamps): `#6E4A8E`
- `--gold` (celebration / first class): `#E8B23A`
- `--mint-ok` (success): `#3B9C6E`
- `--alert` (error, warm): `#C24A3A`

**Neutrals**
- `--line` (hairline borders / ticket perforation): `#D9C9AE`
- `--shadow-ink` (flat shadow color, low alpha): `#122A3A`

**Dark theme ("night flight," optional):** bg `#0E2029`, surface `#16303B`, text `#F3E7D2`, `--sunset` unchanged, `--horizon` → `#3FB0AE`.

Contrast (verified AA): `--ink` on `--paper` ≈ 11:1; `--sunset` used on `--ink` for large text/graphics only; white on `--sunset-deep` passes AA.

## 4. Typography
- **Display / headlines:** **Clash Display** (characterful geometric; used decisively at large sizes, tight tracking). *Fallback: Bricolage Grotesque.*
- **Serif accent (tickets/editorial, prices, dates, stamped details):** **Fraunces** (variable optical serif, warm, distinctive).
- **Body / UI:** **Hanken Grotesk** (clean, warm, highly readable — NOT Inter).
- **Mono (departure board, flight numbers, PNR, countdown digits):** **Martian Mono** (split-flap feel). *Fallback: Space Mono.*
- **Type scale (fluid, mobile-first, ~1.25 ratio with 3×+ jumps for display):** 12 / 14 / 16 (base) / 20 / 25 / 34 / 48 / 64 / 88. Body 16px min on mobile; display uses `clamp()` up to 88px.
- Load via `next/font` (self-host); subset; `font-display: swap`. Confirm licenses for self-hosting (all four are freely available; Bricolage Grotesque / Space Mono are drop-in fallbacks).

## 5. Spacing, Radius, Elevation Tokens
- **Spacing (4px base):** `--space-1:4 · 2:8 · 3:12 · 4:16 · 5:24 · 6:32 · 7:48 · 8:64 · 9:96`.
- **Radius (mixed, deliberate):** `--r-sharp:2px` (tickets/boards), `--r-card:14px`, `--r-lg:24px`, `--r-pill:999px` (primary buttons, chips). Do NOT use one uniform radius everywhere.
- **Elevation (flat, offset, NOT blurry):**
  - `--e-1: 3px 3px 0 rgba(18,42,58,.12)`
  - `--e-2: 5px 6px 0 rgba(18,42,58,.16)`
  - `--e-3: 8px 10px 0 rgba(18,42,58,.20)` (modals, boarding pass)
  - Pair with a 1px `--line` border for the "printed ticket" feel.
- **Die-cut / perforation:** reusable CSS for ticket-stub notches (two circular masks) + dashed `--line` perforation between pass segments.
- **Texture:** subtle paper grain via a tiled SVG/noise overlay at ~4% opacity on `--paper`. Never a purple mesh.

## 6. Illustration & Iconography
- **Illustration style:** flat, screen-printed retro travel-poster aesthetic — limited palette, grain, bold shapes, gentle geometric planes, halcyon skies. Procedural/seeded SVG scenes for trip covers (derived from destination + `cover_seed`) so no stock photos.
- **Icons:** custom 2px-stroke line set (slightly rounded joints, occasional filled accent); if using Lucide as a base, restyle stroke width/color and never mix with emoji. 24px grid. Airline "logos" are generated geometric marks from `logo_seed`.
- **Passport stamps:** circular/oval, single-ink, slightly rotated and imperfect (`rotation_deg`, `ink_hue`), with country + city + fake date.

## 7. Motion Design Principles
- **Purposeful & physical:** motion mimics paper, stamps, split-flap boards, gentle flight. High-impact set-pieces over scattered fidget animations.
- **Durations:** micro 120–180ms; standard UI 220–320ms; set-pieces 600–1200ms (orchestrated).
- **Easings:**
  - `--ease-standard: cubic-bezier(0.2, 0.7, 0.2, 1)` (UI in/out)
  - `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` (entrances)
  - `--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1)` (playful pops); `ease-in-back` for stamp wind-up.
- **Spring configs (Motion):**
  - `springSoft = { type:'spring', stiffness:260, damping:24 }` (cards, sheets)
  - `springBouncy = { type:'spring', stiffness:420, damping:14 }` (buttons, chips, pops)
  - `springHeavy = { type:'spring', stiffness:180, damping:30 }` (page/large)
- **Stagger:** list entrances 40–60ms, ease-out-expo.
- **Reduced motion (hard requirement):** all of the above collapse to opacity-only or instant; no transforms, no confetti (replace with a static celebratory graphic + text), no parallax — implemented once in the motion-token layer.

## 8. Signature Animations & Micro-interactions (catalog)
1. **Departure-board loading state (GSAP + mono font):** search results load as a split-flap solari board flickering through letters/numbers before settling into airline names, times, prices. Staggered rows. THE signature loader.
2. **Boarding-pass reveal (checkout success — GSAP timeline + canvas-confetti):** the pass slides up, a perforation "tears," a stamp thumps down (scale 1.6→1 with ease-in-back + tiny screen shake), a capped confetti burst, gold shimmer sweep.
3. **Passport stamp (Motion + GSAP):** on booking, the stamp winds up (rotate + scale, slight overshoot), thumps with an ink-spread mask reveal + soft dust puff, settles at `rotation_deg`.
4. **Countdown flip (Motion / CSS 3D):** split-flap digits for days:hrs:min:sec; only seconds animate continuously; day rollovers get a flourish; `aria-live` announces day changes only.
5. **Buttons:** primary `--sunset` pill: press = scale 0.96 + shadow offset collapses (physical push), release springs back (`springBouncy`); hover lifts 2px.
6. **Cards (flight/hotel):** hover/tap lifts with flat shadow growth; tap-through does a shared-layout transition (Motion `layoutId`) into the detail page.
7. **Page transitions (`app/template.tsx`):** content enters with a subtle upward fade (`y:8→0`, 300ms). "Boarding" transition into checkout: a boarding-pass-shaped wipe.
8. **Toasts:** slide in from top like a gate announcement; auto-dismiss; success uses `--mint-ok`, playful copy.
9. **Search field focus:** label animates up; a tiny plane icon taxis along the underline.
10. **"You saved $X":** number counts up (ease-out-expo) with a gentle gold shimmer.
11. **Empty states:** friendly illustrated character (optional Rive) waves / paper plane loops.
12. **Pull-to-refresh (mobile):** paper-plane arc.

## 9. Component Inventory (all must use tokens + include reduced-motion variants)
- **Buttons:** Primary (sunset pill), Secondary (outline/ink), Ghost, Icon, Destructive (Settings only). States: default/hover/active/focus-visible/disabled/loading.
- **Inputs:** Text, Autocomplete (airport/city), Date range, Stepper (passengers), Select (cabin), Toggle/Switch, Checkbox (packing), Search bar. Floating labels; inline validation.
- **Cards:** FlightResultCard, HotelCard, TripCard, MemoryCard, StampCard.
- **BoardingPass** (on-screen + PDF variants share layout tokens): airline mark, route with plane arc, flight no, date, seat, gate, class, QR/barcode (simulated), perforation, SIMULATION watermark.
- **DepartureBoard** (results loader + header widget).
- **CountdownFlip.**
- **Stepper/Wizard** (search → results → detail → summary → checkout → confirmation) with a "flight path" progress indicator.
- **ShareSheet** (permission selector, link + copy, active-links list, collaborator rows with role chips); **CollaboratorChip** ("added by Sam" attribution on itinerary items); **CalendarButton** (with "shows as Free" reassurance toast); **Toasts/Snackbar; Modal/Sheet** (bottom sheet on mobile); **Tabs; Chips/Filters; Badge** (incl. SIMULATION badge); **Skeleton/Loader** (departure-board style); **Passport** components (StampGrid, PassportCover, StampDetail); **ItineraryDay/ItineraryItem** (drag handle); **PackingList/PackingItem; SavingsTally; MoodCheckIn; Nav** (bottom tab bar on mobile, safe-area aware).

## 10. Responsive & Touch Guidelines
- **Mobile-first.** Breakpoints: `sm 480`, `md 768` (iPad portrait), `lg 1024` (iPad landscape/desktop), `xl 1280`.
- Bottom tab navigation on mobile (safe-area padding); top/side nav ≥ lg.
- Touch targets ≥ 44×44px; ≥ 8px between targets; gestures — swipe between result cards, swipe-to-dismiss sheets/toasts (Motion drag with elastic), drag-to-reorder itinerary, pull-to-refresh.
- Respect `env(safe-area-inset-*)`; test notch/Dynamic Island and iPad multitasking widths.
- Fluid type via `clamp()`; container queries for cards.

## 11. Accessibility (design-level)
- Reduced-motion default-honored and toggleable.
- AA contrast (verified in §3); focus-visible rings in `--horizon`; never color-only signaling (stamps/board have text).
- Countdown/board use `aria-live="polite"` sparingly; boarding pass/QR have full text alternatives.
- Minimum 16px body; scalable to 200% without breakage.
