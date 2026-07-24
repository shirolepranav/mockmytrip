# WANDERLOST — Implementation Plan (Expanded)

> Companion docs: `PRD.md`, `TECH_SPEC.md`, `DESIGN_SYSTEM.md`, `APP_WORKFLOW.md`.
> Referenced doc sections are abbreviated: TS = TECH_SPEC, DS = DESIGN_SYSTEM, WF = APP_WORKFLOW.

## 0. How to use this plan
- **11 phases (0–10).** Each phase contains: Objective, Prerequisites, Development Tasks (numbered, file-level), QA Test Cases (with expected results), Regression Tests, Exit Criteria, and an effort estimate (solo experienced dev + AI coding agent).
- **Phases are sequential.** Do not start a phase until the previous phase's Exit Criteria are all green.
- **Regression policy (per project owner's explicit instruction):** each phase runs regression tests **ONLY on the new features introduced in that phase** — not the full app. The one standing exception: the two **ethics guard tests** (no-payment-field, SIMULATION-present) run in CI on *every* commit from Phase 5 onward, because they protect hard product guarantees.
- **Definition of Done (every task):** TypeScript strict passes; lint passes; uses design tokens (no hardcoded hex/spacing); has a reduced-motion variant if animated; has at least one test; works at 390px and 768px widths.

## Testing infrastructure (set up in Phase 0, used everywhere)
- **Unit/component:** Vitest + React Testing Library (`*.test.ts[x]` colocated).
- **E2E:** Playwright — projects for `iPhone 14` (390×844), `iPad (gen 10)` (820×1180), and `Desktop Chrome`. Every e2e listed below runs on all three unless marked mobile-only.
- **A11y:** `@axe-core/playwright` assertions inside e2e specs (0 critical violations to pass).
- **Perf:** Lighthouse CI (`lhci`) against preview builds; budgets from TS §9.
- **CI (GitHub Actions):** `lint → typecheck → unit → e2e (changed-scope tag) → lhci` on PR; full suite nightly.
- **Test tagging:** every spec is tagged `@phaseN`; "regression on new features only" = run `--grep @phaseN` for the current phase.

---

## PHASE 0 — Scaffolding, Design Tokens & CI
**Objective:** a deployed, empty-but-branded app shell with the entire design-token system, motion layer, and test/CI pipeline in place — so every later phase builds on rails.
**Prerequisites:** none.
**Estimate:** 2–3 days.

### Development tasks
1. `create-next-app` (App Router, TS strict, Tailwind v4, ESLint). Add Prettier. Configure `tsconfig` strict + path aliases (`@/components`, `@/lib`).
2. Install deps: `motion`, `gsap @gsap/react` (dynamic-import later), `canvas-confetti`, `drizzle-orm`, `zod`, `@serwist/next` (configured but disabled until Phase 8).
3. Create `app/globals.css` with **all** design tokens from DS §3–§7 as CSS variables (colors, spacing, radii, elevations, easings, durations) + Tailwind v4 `@theme` mapping.
4. Self-host fonts via `next/font/local`: Clash Display, Fraunces, Hanken Grotesk, Martian Mono (fallbacks per DS §4). Expose as CSS vars `--font-display`, `--font-serif`, `--font-body`, `--font-mono`.
5. Add paper-grain texture overlay (tiled SVG noise, ~4% opacity) on `--paper` background.
6. Build `lib/motion/`:
   - `tokens.ts` — durations, easings, spring configs (`springSoft/springBouncy/springHeavy`) from DS §7.
   - `reduced-motion.tsx` — a `MotionProvider` reading `prefers-reduced-motion` **and** a (future) settings override; exports `useMotionPrefs()`. All variants must route through this.
   - `variants.ts` — shared enter/exit/stagger variants.
7. Build app shell: `(app)/layout.tsx` with bottom tab bar (mobile, safe-area aware) / top nav (≥lg), theme provider (light + "night flight" scaffold), and the **SIMULATION badge** component (`components/simulation-badge.tsx`) pinned on all `(app)` routes; tapping opens an explainer sheet.
8. `app/template.tsx` page-transition wrapper (y:8→0 fade, 300ms; instant under reduced motion).
9. Create `/dev/components` gallery page rendering every token: color swatches, type scale, spacing, elevations, buttons placeholder.
10. Testing/CI: Vitest config; Playwright config with the 3 device projects + `@phaseN` tagging; axe integration; Lighthouse CI config with TS §9 budgets; GitHub Actions workflow.
11. Deploy to Vercel (Hobby); set env scaffolding (`.env.example` with `DATABASE_URL`, `RESEND_API_KEY`, `VAPID_*`, `LLM_API_KEY`).
12. Add `scripts/check-banned-styles.mjs` lint step: greps built CSS/classNames for banned patterns (Inter/Roboto font-family, `from-purple`/`to-indigo` gradients, raw hex not in tokens file) — the anti-vibe-code gate.

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 0.1 | Load `/dev/components` on iPhone 14 viewport | All tokens render; fonts are Clash/Fraunces/Hanken/Martian (assert computed `font-family`), not Inter/system |
| 0.2 | Toggle OS reduced-motion, reload | `template.tsx` transition is instant; provider reports `reduced: true` |
| 0.3 | Shell nav on 390px | Bottom tab bar visible, ≥44px targets, safe-area padding applied |
| 0.4 | Shell nav on 1024px | Top nav; no bottom bar |
| 0.5 | SIMULATION badge | Present on every `(app)` route; tap opens explainer sheet; axe: 0 critical |
| 0.6 | `check-banned-styles` with a planted violation | CI fails |
| 0.7 | Lighthouse on deployed shell | A11y ≥ 95; Best Practices ≥ 95 |

### Regression tests (new features only)
- `@phase0` suite: token snapshot test; shell renders at 390/820/1280; reduced-motion provider unit tests; banned-styles script test.

### Exit criteria
- ✅ Deployed shell on Vercel; ✅ all `@phase0` tests green in CI; ✅ fonts/tokens verified non-generic; ✅ reduced-motion layer works; ✅ banned-styles gate active.

---

## PHASE 1 — Synthetic Data Engine (headless)
**Objective:** a fully-tested, deterministic engine that turns any valid route+date query into realistic fake flights, hotels, and prices — no UI yet.
**Prerequisites:** Phase 0.
**Estimate:** 3–4 days.

### Development tasks
1. `scripts/seed-airports.mts`: download OurAirports `airports.csv`; filter per TS §5.1 (`large_airport|medium_airport`, `scheduled_service='yes'`, has IATA); attach IANA tz via `tz-lookup`; emit (a) `data/airports.seed.json` (full) and (b) `public/data/airports.slim.json` (iata, name, city, country, lat, lng, tz — target < 300 KB gzip) for client autocomplete.
2. `lib/engine/seed.ts`: `hashSeed(input: string): number` (e.g., cyrb53) + `seededRandom(seed)` PRNG (mulberry32). One normalized-query → seed util `querySeed(params)`.
3. `lib/engine/distance.ts`: haversine per TS §5.3 with antipodal guard; export `distanceKm(a, b)`.
4. `lib/engine/names.ts`: curated ~40 fictional airlines (name, 2-letter code, hue, logo_seed) + hotel name generator (`[Prefix]+[Core]+[Type]` word banks) + `data/brand-blocklist.json` (real airline/hotel brand substrings); `assertNotRealBrand(name)` throws on collision — called on every generated name.
5. `lib/engine/schedule.ts`: departure banks (06–09/11–14/17–21), 3–8 flights/day per route seeded; duration = cruise (875 km/h jet, 550 km/h < 400 km) + 30 min overhead, snapped to 5 min; stops rule (direct < 4,500 km or major route, else 1 stop via hub list with 60–120 min layover); timezone-correct `arrive_at`; plausible flight numbers (`code + 2–4 digits`, seeded).
6. `lib/engine/pricing.ts`: per TS §5.4 — distance-band per-km rates with $39 floor, month seasonality, day-of-week (Fri/Sun peak), days-until-departure curve, cabin multipliers, ±8% seeded jitter. Returns `price_cents` and `saved_cents` (= full price).
7. `lib/engine/hotels.ts`: seeded hotel generation per city (name, stars 3–5 weighted, neighborhood flavor, amenities, `nightly_base_cents` by city cost tier, hero_seed) + nightly pricing (base × seasonality × star × jitter).
8. `lib/engine/index.ts`: public API — `searchFlights(query): FlightOffer[]`, `searchHotels(query): HotelOffer[]`, fully typed with Zod schemas for inputs.
9. Generated airline SVG logo function `logoFor(logo_seed)` (deterministic geometric mark).

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 1.1 | `distanceKm(JFK, LHR)` | 5,540 km ± 1% |
| 1.2 | `distanceKm(SIN, EWR)` (near-antipodal long-haul) | ~15,300 km ± 1%, no NaN |
| 1.3 | Duration JFK→LHR | 6.5–8h; arrive_at local time consistent with tz delta |
| 1.4 | Short hop (d < 400 km, e.g., AMS→LHR-class route) | Turboprop-profile duration; direct |
| 1.5 | Ultra-long (d > 10,000 km) | 0–1 stops; if 1 stop, layover 60–120 min via hub |
| 1.6 | Price monotonicity | Same date/cabin: longer route ⇒ total ≥ shorter route's total × 0.9 (band-aware sanity) |
| 1.7 | Price floor | Any route ≥ $39 economy |
| 1.8 | Cabin multipliers | business ≈ 3.2× economy ± jitter bounds |
| 1.9 | Determinism | `searchFlights(q)` called twice ⇒ deep-equal results; different date ⇒ different jitter |
| 1.10 | Brand blocklist | Generator run 10,000× emits zero blocklisted names; planted "Delta Hotel" input throws |
| 1.11 | Slim airports JSON | < 300 KB gzip; JFK, LHR, HND, small-island airport all present with tz |
| 1.12 | Hotel generation | 8–20 hotels per major city; stars 3–5; deterministic per city+seed |

### Regression tests (new features only)
- `@phase1` unit suite (all cases above) — 100% must pass; engine functions ≥ 90% line coverage.

### Exit criteria
- ✅ All `@phase1` green; ✅ determinism verified; ✅ blocklist enforced in the generator itself; ✅ slim JSON size budget met.

---

## PHASE 2 — Database, Auth & Core Models
**Objective:** persistent guest-first identity, schema + migrations, and the services layer that all later mutations flow through.
**Prerequisites:** Phase 1 (airports seed feeds the DB).
**Estimate:** 3–4 days.

### Development tasks
1. Provision Neon; `lib/db/client.ts` (HTTP driver) + `lib/db/schema.ts` implementing every table/index from TS §4; drizzle-kit migrations; `npm run db:migrate`, `npm run db:seed` (loads airports + airlines).
2. Guest-first sessions: `lib/auth/session.ts` — on first mutation-needing visit, create `users` row (`is_guest=true`) + signed httpOnly `sameSite=lax` cookie. Middleware-free (cookie read in server actions/services) to stay Capacitor-safe.
3. Magic-link upgrade: Auth.js Email provider via Resend; on sign-in, merge guest data (re-parent trips/bookings/stamps to the account user, then delete guest row). Rate-limit link requests (max 3/hour/email).
4. `lib/services/` layer (TS §3 architectural rule): `users.ts` (getOrCreateGuest, exportData, deleteAll), `trips.ts` (create/rename/delete/list), ownership assertion helper `assertOwner(userId, resource)`. **All business logic lives here; Server Actions are thin wrappers.**
5. `actions/` wrappers with Zod input validation calling services.
6. Data export: `services/users.exportData(userId)` returns full JSON of user's rows. Hard delete: cascading delete + cookie clear.
7. Seed `airlines` table from engine's curated list.

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 2.1 | First visit + first save | Guest user row created once; cookie set httpOnly/secure/sameSite |
| 2.2 | Second save same browser | No duplicate user |
| 2.3 | Magic link flow (Resend test) | Email received; link signs in; guest trips now owned by account; guest row gone |
| 2.4 | Rate limit | 4th magic-link request in an hour → friendly error, no email |
| 2.5 | Ownership | User A requests User B's trip via forged id → 403/denied, no data leak |
| 2.6 | Export | JSON contains all and only the user's rows; no other users' data |
| 2.7 | Delete | All user rows cascade-deleted; cookie cleared; re-visit creates fresh guest |
| 2.8 | Migrations | `db:migrate` from empty DB is idempotent; `db:seed` loads airports (count > 2,000) + ~40 airlines |

### Regression tests (new features only)
- `@phase2`: auth e2e (guest → save → magic-link upgrade → export → delete); services unit tests; migration smoke test.

### Exit criteria
- ✅ All `@phase2` green; ✅ zero business logic inside `actions/` (code-review checklist); ✅ export/delete verified.

---

## PHASE 3 — Flight Search → Results → Detail
**Objective:** the core browse loop for flights, with the signature departure-board loader — the first "wow" surface.
**Prerequisites:** Phases 1–2.
**Estimate:** 4–5 days.

### Development tasks
1. `components/airport-autocomplete.tsx`: client-side fuzzy search over `airports.slim.json` (lazy-loaded, cached); matches city/airport/IATA; keyboard + touch; floating label + taxiing-plane focus animation (DS §8.9); recent-search chips (localStorage).
2. Flight search page `search/flights/page.tsx` per WF §3: fields, round-trip toggle, passengers stepper (1–9), cabin select; Zod validation — origin≠destination, no past departure, return ≥ departure; inline errors.
3. Server-side results: `search/flights/results/page.tsx` reads query params → `searchFlights()` (seeded) with `unstable_cache`/`revalidateTag` keyed on normalized query.
4. **DepartureBoard loader** (`components/departure-board.tsx`, GSAP, dynamic-imported): split-flap flicker rows settling into results (DS §8.1); reduced-motion = simple fade skeleton. Wire into `loading.tsx`.
5. `components/flight-result-card.tsx` per DS §9: airline mark (`logoFor`), times, duration, stops, price, "you'd save $X"; staggered entrance (40–60ms); Motion `layoutId` for shared-layout into detail.
6. Sort (price/duration/departure) + filters (stops, cabin, airline, time-of-day) — URL-param driven so results stay deterministic and shareable.
7. Flight detail `flight/[id]/page.tsx` per WF §5: segment breakdown, layovers, fare options, aircraft/baggage flavor text; "Select this flight" persists a **trip draft** (cookie/DB via `services/trips.draft`).
8. Edge cases: no-results state (nearby-airport suggestions), same-day return, island route (assert 1-stop appears), back-preserves-scroll.

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 3.1 | Type "toky" in origin | HND/NRT appear ≤ 150ms after load; selectable by touch + keyboard |
| 3.2 | Origin = destination | Inline error; submit blocked |
| 3.3 | Past departure date | Blocked with friendly message |
| 3.4 | Search JFK→LHR next month | Loader appears < 100ms; board animation plays; results < 2s; ≥ 5 offers; consistent times/durations |
| 3.5 | Re-run identical search | Identical results (determinism through the UI) |
| 3.6 | Sort by price / duration | Order correct; URL updates; refresh preserves sort |
| 3.7 | Filter nonstop on a stop-only route | Empty state with "try nearby airports" suggestions |
| 3.8 | Tap card → detail | Shared-layout transition; back restores scroll position |
| 3.9 | Select flight | Trip draft persisted; survives reload |
| 3.10 | Reduced motion | Board loader replaced by fade skeleton; no flip/transform animation |
| 3.11 | iPhone + iPad viewports | No horizontal scroll; targets ≥ 44px; axe 0 critical |

### Regression tests (new features only)
- `@phase3` e2e: full search→results→detail→select happy path + cases 3.2/3.3/3.7 edge specs; autocomplete unit tests.

### Exit criteria
- ✅ All `@phase3` green on all 3 device projects; ✅ determinism verified through UI; ✅ loader has reduced-motion variant; ✅ draft persistence works.

---

## PHASE 4 — Hotel Search → Results → Detail + Trip Summary
**Objective:** complete the browse loop with hotels and assemble the trip draft into a summary ready for checkout.
**Prerequisites:** Phase 3.
**Estimate:** 2–3 days.

### Development tasks
1. Hotel search `search/hotels/page.tsx` per WF §6: destination + dates prefilled from the flight draft (editable); guests/rooms; "skip hotels" path; validation checkout > checkin.
2. Hotel results per WF §7: `components/hotel-card.tsx` (generated name, stars, neighborhood, nightly + total, savings, seeded SVG hero, amenity chips); sort/filter (price/stars/amenities); paper-plane loader variant.
3. Hotel detail per WF §8: seeded illustration gallery, flavor text, amenities, room types, static illustrative "map" (clearly labeled non-real), "Select hotel" → adds to draft.
4. Seeded destination hero art: `components/destination-art.tsx` — procedural SVG scene from `cover_seed` (skyline/beach/mountain templates by destination metadata). Reused for trip covers later.
5. Trip summary `trip/summary/page.tsx` per WF §9: flight(s) + hotel, travelers, dates, struck-through "real" total + total savings, editable auto-title ("5 days in Lisbon"), edit-segment links that return to the right search **preserving state**, "Continue to checkout" CTA.
6. Missing-piece states: flight-only (prompt to add hotel or continue), hotel-only allowed? — **No**: flight is required first (enforced + friendly redirect).

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 4.1 | Arrive from flight select | Destination/dates prefilled correctly |
| 4.2 | Checkout date ≤ checkin | Blocked inline |
| 4.3 | Hotel results for Lisbon | 8–20 fictional hotels; zero real brand names (automated blocklist scan of rendered DOM) |
| 4.4 | Same query re-run | Identical hotels/prices |
| 4.5 | Select hotel → summary | Both segments listed; totals = flight + hotel×nights; savings = full totals |
| 4.6 | Edit flight from summary | Returns to results with prior query + scroll; re-select updates summary |
| 4.7 | Skip hotels | Summary shows flight-only; checkout allowed |
| 4.8 | Direct-nav to summary with empty draft | Friendly redirect to flight search |
| 4.9 | Auto-title | Sensible ("N days in City"); editable; persists |
| 4.10 | Viewports + axe | 390/820 clean; 0 critical |

### Regression tests (new features only)
- `@phase4` e2e: hotel search→detail→select→summary; skip-hotel path; empty-draft redirect; DOM brand-blocklist scan.

### Exit criteria
- ✅ All `@phase4` green; ✅ end-to-end draft (flight+hotel) assembles correctly; ✅ no real brands in rendered output.

---

## PHASE 5 — Fake Checkout, Boarding Pass, Email & First Stamp
**Objective:** the emotional peak — $0.00 checkout, the boarding-pass reveal set-piece, PDF + email, and the passport stamp write. Ethics guards become permanent CI gates here.
**Prerequisites:** Phase 4.
**Estimate:** 4–5 days.

### Development tasks
1. Checkout page `trip/checkout/page.tsx` per WF §10: order summary; struck-through synthetic total + **$0.00 due**; count-up "You're saving $X" (DS §8.10); pinned SIMULATION banner; optional email field ("Send my boarding pass?"); Confirm CTA. **Zero payment/card/billing inputs.**
2. `services/bookings.createBooking(draft, userId, email?)`: transactionally create `trips` row, `flights` row (materialized offer), `bookings` (fake PNR `SIM-` + 6 alphanumerics, seat like `14A`, gate like `B12`), `passport_stamps` row (style/rotation/ink seeded), increment `users.total_saved_cents`. Idempotency key = draft hash (double-tap safe).
3. **Boarding-pass reveal set-piece** (GSAP timeline + canvas-confetti, dynamic-imported) per DS §8.2: pass slides up → perforation tear → stamp thump (1.6→1, ease-in-back, micro screen-shake) → capped confetti (≤ 150 particles mobile) → gold shimmer. Reduced-motion: instant pass + static celebratory graphic + text.
4. `components/boarding-pass.tsx` per DS §9: shared layout tokens for screen + PDF; SIMULATION watermark; QR (via `qrcode`) encoding `SIMULATION|{pnr}`.
5. PDF route `api/boarding-pass/[bookingId]/route.ts`: `@react-pdf/renderer` stream; auth + ownership; QR as PNG data URI; filename `wanderlost-{pnr}.pdf`.
6. Email: React Email template `lib/email/booking-confirmation.tsx` — subject `Your (pretend) trip to {city} is booked ✈` with "This is a simulation — no travel is booked, nothing was charged" banner top **and** bottom; PDF attached; Resend send with per-booking idempotency; graceful skip on failure/quota (toast: "Email couldn't send — your pass lives right here").
7. Confirmation page `trip/confirmation/[bookingId]/page.tsx` per WF §11: pass, Download PDF, email status note, "Start the countdown" CTA, passport link.
8. **Permanent ethics guard tests** (CI on every commit from now on):
   - `ethics/no-payment-fields.spec.ts`: crawls checkout + confirmation DOM; asserts zero inputs with name/id/autocomplete matching `card|cc-|cvv|cvc|billing|expiry|iban|pay`, and zero payment SDK scripts.
   - `ethics/simulation-present.spec.ts`: asserts SIMULATION label visible on checkout, on-screen pass, PDF text layer, and email HTML.

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 5.1 | Checkout renders | $0.00 due; struck-through total; savings count-up; SIMULATION pinned while scrolling |
| 5.2 | Payment-field scan | 0 matches (guard spec) |
| 5.3 | Confirm booking | Reveal set-piece plays ≤ 1.2s; trip/booking/flight/stamp rows created; savings tally incremented correctly |
| 5.4 | Double-tap Confirm | Exactly one booking (idempotency) |
| 5.5 | Reduced-motion confirm | No confetti/shake; static celebration; booking still created |
| 5.6 | Download PDF | Valid PDF; QR decodes to `SIMULATION\|{pnr}`; SIMULATION watermark in text layer |
| 5.7 | Email provided | Received (Resend test); disclaimer top+bottom; PDF attached; subject marked pretend |
| 5.8 | Email omitted / Resend failing (mocked) | Booking + pass still succeed; friendly toast |
| 5.9 | Forged bookingId PDF request | Denied; no info leak |
| 5.10 | Checkout error (DB down, mocked) | Friendly retry; draft NOT lost |
| 5.11 | Viewports + axe on checkout/confirmation | Clean; 0 critical |

### Regression tests (new features only)
- `@phase5` e2e: full checkout→confirmation→PDF happy path; idempotency; email-skip path; plus the two ethics guards (which additionally become always-on CI gates).

### Exit criteria
- ✅ All `@phase5` green; ✅ ethics guards wired as required CI checks; ✅ reveal has full reduced-motion variant; ✅ idempotent booking.

---

## PHASE 6 — My Trips, Trip Detail, Countdown & Passport
**Objective:** the savoring loop — dashboard, live countdown, and the collectible passport.
**Prerequisites:** Phase 5.
**Estimate:** 3–4 days.

### Development tasks
1. Trips dashboard `trips/page.tsx` per WF §12: TripCards grouped Upcoming (mini-countdown chip) / In progress / Memories; savings-tally header; empty state ("Your adventures await"); rename/delete via overflow (plain confirm, no shaming).
2. Trip status derivation: `services/trips.statusOf(trip, now)` → `upcoming | in_progress | memory` from start/end dates; a lightweight recompute on read (no cron needed).
3. Trip detail `trips/[tripId]/page.tsx` per WF §13: seeded destination hero, **CountdownFlip**, facts, links (Itinerary/Packing/Pass/Stamp), savings.
4. `components/countdown-flip.tsx` per DS §8.4: split-flap days:hrs:min:sec in Martian Mono; only seconds animate continuously; day-rollover flourish; `aria-live="polite"` announcing day changes only; reduced-motion = static numbers updating each minute. Timezone-correct against the departure airport's tz.
5. Departure-day state: "Bon voyage!" celebratory variant; in-progress state during trip dates.
6. **Past-dated guard:** trip already past on load → route to memory state; never render negative countdown (WF §13 edge case).
7. Passport `passport/page.tsx` per WF §16: PassportCover, StampGrid of StampCards (country/city/date/style/rotation/ink), counts (countries, cities, "miles dreamed" from distances), savings total; stamp-detail sheet on tap; entrance stamp animation when arriving from a fresh booking (DS §8.3).

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 6.1 | Dashboard with 0 trips | Illustrated empty state + CTA |
| 6.2 | Dashboard with 3 trips (upcoming/in-progress/past seeded) | Correct grouping; mini-countdowns tick; savings header = sum |
| 6.3 | Countdown accuracy | Matches expected delta for a trip 10d 3h out (±1s); correct across a tz-different route |
| 6.4 | Day rollover (mock clock crossing midnight) | Flourish plays once; aria-live announces once |
| 6.5 | Past-dated trip opened | Memory state; no negative numbers anywhere |
| 6.6 | Departure day (mock clock) | "Bon voyage!" state |
| 6.7 | Rename/delete trip | Rename persists; delete removes trip + bookings, keeps stamp history policy (stamps persist — they're memories) |
| 6.8 | Passport with 3 stamps | Grid renders; each stamp deterministic (style/rotation stable across reloads); tap opens detail |
| 6.9 | Fresh booking → passport | New stamp animates in; reduced-motion = appears instantly |
| 6.10 | "Miles dreamed" | Equals sum of booked route distances ± rounding |
| 6.11 | Viewports + axe | Clean; countdown not spamming screen readers |

### Regression tests (new features only)
- `@phase6` e2e: dashboard grouping; countdown incl. mocked-clock rollover + past-dated guard; passport render + stamp entrance; rename/delete.

### Exit criteria
- ✅ All `@phase6` green; ✅ no negative countdown possible; ✅ tz-correct countdown; ✅ stamps deterministic.

---

## PHASE 7 — Itinerary, Packing, AI Suggestions & Explore (Real POIs) (Tier 2)
**Objective:** deepen anticipation with planning tools; add the optional LLM layer safely (quota + graceful fallback); make the app useful for **actual** trip planning via real sights/restaurants (Explore) and itinerary export.
**Prerequisites:** Phase 6.
**Estimate:** 5–6 days.

### Development tasks
1. Itinerary `trips/[tripId]/itinerary/page.tsx` per WF §14: day columns/list from trip dates; add item (title, optional time, category food/sight/activity/transit/rest, note); inline edit; delete with undo toast (8s); drag-to-reorder within/between days (Motion drag, touch-friendly, ≥44px handles); `sort_order` persistence; optimistic saves via `useOptimistic`.
2. Packing `trips/[tripId]/packing/page.tsx` per WF §15: auto-generate starter list from destination climate band (from lat + month) + trip length + categories; satisfying tick micro-interaction; progress bar; add custom; reset-to-auto; small all-checked celebration (reduced-motion safe).
3. `lib/services/itinerary.ts` + `packing.ts` with ownership checks; `actions/` wrappers.
4. LLM integration `lib/services/ai.ts`: single function `suggestItinerary(city, days, interests?)` calling the LLM API; strict Zod parse of JSON output; per-user daily quota (e.g., 5 calls) stored in DB; timeout 15s; on any failure → friendly "The travel muse is resting — try again later" with manual authoring unaffected. Same pattern reserved for memory text in Phase 8.
5. Offline-tolerant saves: queue mutations in IndexedDB when offline flag set; flush on reconnect (scaffold; full offline in Phase 8).
6. **POI seed** `scripts/seed-pois.mts` per TS §5.6: Wikidata (sitelink-ranked attractions) + Wikivoyage listings + OSM/Overpass restaurants for the top ~100 destination cities; dedupe, rank, keep top ~30–50/city; store with `attribution` + `source_id`; polite rate limiting; cached raw responses.
7. **Explore page** per WF §20: category tabs, `components/poi-card.tsx` (name, description, distance, image when licensed, **"Real place" chip**, attribution line), POI detail sheet, "city not seeded" state, attribution footer; entry points from trip detail / itinerary / detail pages.
8. **Itinerary ↔ POI integration:** "Add from Explore" sheet inserts a POI-linked itinerary item (`poi_id` fk); AI suggestions may reference seeded POIs (prompt includes top POIs for the city); no fake ratings/prices on POIs anywhere.
9. **Itinerary export** per WF §14: print-friendly view + text/PDF export (reuse react-pdf) so plans are usable for real trips; includes POI names + real addresses where sourced, and a footer noting bookings were simulated.

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 7.1 | Add/edit/delete itinerary item | Persists; undo within 8s restores; order stable |
| 7.2 | Drag reorder on touch (Playwright touch) | New order persists across reload |
| 7.3 | Item on day beyond trip length | Prevented / clamped with message |
| 7.4 | AI suggest happy path (mocked LLM) | 3–6 valid items proposed; accept inserts; edit works |
| 7.5 | AI malformed JSON (mocked) | Graceful error; no crash; manual add still works |
| 7.6 | AI quota exceeded | Friendly quota message; no API call made |
| 7.7 | Packing auto-fill: Reykjavik in Jan vs Bangkok in Jul | Cold-weather vs hot-weather lists differ sensibly; length scales with trip days |
| 7.8 | Check/uncheck + progress | Progress bar accurate; all-checked celebration once; reduced-motion variant |
| 7.9 | Ownership | Other user's itinerary mutation denied |
| 7.10 | Viewports + axe | Drag usable at 390px; 0 critical |
| 7.11 | POI seed for Paris | 30–50 POIs; Eiffel Tower-class landmarks present near top rank; every row has attribution + source_id |
| 7.12 | Explore page (seeded city) | Tabs filter correctly; every PoiCard shows "Real place" chip; zero fake prices/ratings on POIs (DOM scan) |
| 7.13 | Explore (unseeded city) | Friendly "not mapped yet" state + nearby suggestion; no crash |
| 7.14 | Add POI to itinerary day 2 | POI-linked item appears on day 2 with real name; undo works; `poi_id` persisted |
| 7.15 | Itinerary export | Print view + PDF contain all items incl. POI addresses; footer notes simulated bookings; opens on mobile |
| 7.16 | Attribution | POI detail + Explore footer show OSM/Wikidata/Wikivoyage credits |

### Regression tests (new features only)
- `@phase7` e2e: itinerary CRUD+reorder; packing auto-fill/check; AI mocked happy/failure/quota specs; POI seed unit tests; Explore render + add-to-itinerary + export specs; POI no-fake-data DOM scan.

### Exit criteria
- ✅ All `@phase7` green; ✅ AI is strictly optional (all failures leave manual flows intact); ✅ quota enforced; ✅ POIs real-data-only with attribution; ✅ export usable for real trips.

---## PHASE 8 — PWA, Offline, Web Push & Trip Memories
**Objective:** installable app with offline reading, opt-in push for countdown milestones, and the memories/afterglow loop.
**Prerequisites:** Phase 7.
**Estimate:** 3–4 days.

### Development tasks
1. Enable Serwist per TS §8: `app/sw.ts` (precache shell + slim airports JSON; runtime `defaultCache`; `/~offline` navigation fallback), `app/manifest.ts` (name, standalone, brand `theme_color`/`background_color`, maskable 192/512 icons), disable SW in dev; guard registration with native-platform check (TS §12.5).
2. Offline behavior per WF §20: offline banner in shell; My Trips + trip detail readable from cache/IndexedDB; search shows "dreams need a connection" state; Phase-7 mutation queue flushes on reconnect.
3. Contextual install prompt: only after first boarding pass; dismissible; never nags again for 30 days (WF §20).
4. Web push: VAPID keys; `push_subscriptions` table wiring; `api/push/subscribe` (opt-in from Settings/trip detail only); Vercel Cron → `api/push/send` computing milestone sends (30d/7d/1d/departure-day + memories-unlocked), frequency-capped (max 1/day/user), copy warm not naggy.
5. Trip Memories `trips/[tripId]/memories/page.tsx` per WF §17: locked state pre-end-date (shows unlock date); unlocked recap — postcard (destination art + stamp + route + savings), reflective note field (local), optional LLM memory paragraph (same quota/fallback as Phase 7); share postcard via Web Share API (opt-in); graceful in-session unlock if end date passes while open.
6. Settings completion per WF §18: reduced-motion toggle (wired to MotionProvider override), theme switch (light/night flight), notifications opt-in + frequency, mood check-in toggle, export/delete (from Phase 2), About link.
7. About/Ethics page per WF §19 (static content, research summaries, OurAirports credit, FAQ).

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 8.1 | Lighthouse PWA | Installable ✓; manifest + icons valid |
| 8.2 | Airplane-mode reload | Shell loads; My Trips + a trip detail readable; `/~offline` fallback on uncached route |
| 8.3 | Offline search | Friendly offline state; no crash |
| 8.4 | Offline itinerary add → reconnect | Queued mutation syncs exactly once |
| 8.5 | Install prompt | Appears only after first pass; dismiss suppresses ≥ 30 days |
| 8.6 | Push opt-in flow | No permission request before explicit toggle; subscription row created; opt-out deletes it |
| 8.7 | Milestone send (mock cron at T-7d) | One push, correct copy; cap prevents a second same-day push |
| 8.8 | Memories locked/unlocked | Locked before end date; unlocked after (mock clock); in-session unlock is graceful |
| 8.9 | Postcard share | Web Share sheet on mobile; copy-link fallback desktop |
| 8.10 | Reduced-motion settings toggle | Overrides OS setting both directions, app-wide, immediately |
| 8.11 | Theme switch | Night-flight tokens applied; contrast still AA (spot-check axe) |
| 8.12 | SW disabled in dev / native guard | No SW registration in dev; `isNativePlatform` mock skips registration |

### Regression tests (new features only)
- `@phase8` e2e: install/offline/queue-sync; push opt-in/opt-out; memories lock/unlock; settings toggles.

### Exit criteria
- ✅ All `@phase8` green; ✅ push strictly opt-in + capped; ✅ offline read path works; ✅ memories loop complete.

---

## PHASE 9 — Sharing, Collaboration & Calendar Export
**Objective:** make anticipation social and the plans portable — tokenized share links, collaborative itinerary editing, and `.ics` calendar export, all with hard guards against real-world confusion and referral dark patterns.
**Prerequisites:** Phase 8 (itinerary + POIs + notifications must exist).
**Estimate:** 4–5 days.

### Development tasks
1. Schema (TS §4): `trip_shares`, `trip_collaborators`, add `itinerary_items.created_by_user_id`; migrations + indexes (`token` unique, `(trip_id,user_id)` unique).
2. `lib/services/access.ts`: `assertCanView(userId, tripId)` / `assertCanEdit(userId, tripId)` resolving owner **and** collaborator roles. Refactor every existing itinerary mutation to route through `assertCanEdit` (owner-only actions — delete trip, bookings, passport — keep `assertOwner`).
3. `lib/services/shares.ts`: `createShare(tripId, permission)` (22-char base62 CSPRNG token), `listShares`, `setPermission`, `revokeShare`, `joinAsCollaborator(token, userId)`, `removeCollaborator`, `setCollaboratorRole`. Rate-limit share creation (10/user/day).
4. **Share sheet** `components/share-sheet.tsx` per WF §20b: permission selector, copy button, Web Share API on mobile, active-links list with view counts + revoke, collaborators list with downgrade/remove. Plain confirms, zero referral copy.
5. **Public shared page** `app/s/[token]/page.tsx` per WF §20c: Server Component token resolution; SIMULATION banner above the fold; itinerary with "added by" chips; revoked/expired/deleted friendly states; "Add your ideas" CTA → sign-in/guest-upgrade → `joinAsCollaborator`; "Make your own" CTA. Rate-limit token lookups by IP; cache ≤ 60s so revocation is near-immediate.
6. Collaborative editing on the shared page and owner's itinerary: attribution chips, last-write-wins per item, `sort_order` re-normalization on read, refresh-on-focus (`revalidateTag`) rather than realtime.
7. Collaborator notifications: `notify_opt_in` on join (**default false**, explicit opt-in only); milestone pushes reuse Phase 8 cron; owner receives at most one batched "new ideas" notice per day.
8. **Calendar export** `app/api/calendar/[tripId]/route.ts` per TS §8b.3: RFC 5545 VCALENDAR with `SUMMARY:✈ (Pretend) {City} · Wanderlost`, disclaimer-first `DESCRIPTION`, `TRANSP:TRANSPARENT`, `STATUS:TENTATIVE`, stable `UID`, destination `VTIMEZONE`, optional all-day itinerary events, no ORGANIZER/ATTENDEE. Auth + `assertCanView`.
9. "Add to calendar" button on trip detail, confirmation, and shared page per WF §20d, with download-blocked fallback and the "shows as Free" reassurance toast.
10. Settings: manage all shares in one place (revoke any link, leave a trip you were invited to).
11. **Guard tests** added to the permanent CI set: `ethics/no-referral-gating.spec.ts` (greps for "invite … to unlock|refer a friend to" patterns) and `ethics/calendar-labeling.spec.ts` (asserts `.ics` contains the pretend title, disclaimer, and `TRANSP:TRANSPARENT`).

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 9.1 | Generate view-only link | Token 22 chars, unguessable, not derived from tripId; `/s/[token]` renders without auth |
| 9.2 | SIMULATION on shared page | Visible without scrolling at 390px; guard spec passes |
| 9.3 | Privacy scan of shared page | Owner email, other trips, passport, savings totals all absent from DOM + JSON payload |
| 9.4 | Revoke link | Next request to `/s/[token]` shows "tucked away" within ≤ 60s; collaborator's open tab fails gracefully on next mutation |
| 9.5 | Edit-permission join | Sign-in/guest-upgrade creates collaborator row (role editor); trip appears in their dashboard |
| 9.6 | Collaborator adds POI to day 2 | Item saved with `created_by_user_id`; "added by" chip renders for owner |
| 9.7 | Collaborator privilege boundaries | Cannot delete trip, alter bookings, view owner's other trips/passport → all denied (403), no leak |
| 9.8 | Downgrade editor → viewer | Subsequent mutation denied; existing items remain, still attributed |
| 9.9 | Concurrent edits (two sessions) | Last-write-wins; no duplicate/lost items; order re-normalizes sanely |
| 9.10 | Share rate limit | 11th share in a day → friendly message, no token created |
| 9.11 | `.ics` import into Google Calendar + Apple Calendar | Imports cleanly; title shows "(Pretend)"; description disclaimer first line |
| 9.12 | `.ics` availability | `TRANSP:TRANSPARENT` present → renders as **Free**, not Busy |
| 9.13 | `.ics` re-import | Stable `UID` updates the existing event instead of duplicating |
| 9.14 | `.ics` timezone | Departure time correct in destination tz; all-day items use `VALUE=DATE` |
| 9.15 | No OAuth | No Google auth flow, no calendar-read scope requested anywhere (network log clean) |
| 9.16 | Referral-gating grep | 0 matches; no feature/stamp gated behind sharing |
| 9.17 | Collaborator notifications | Default off; only sent after explicit opt-in; owner "new ideas" batched ≤ 1/day |
| 9.18 | Viewports + axe on share sheet + shared page | 390/820 clean; 0 critical |

### Regression tests (new features only)
- `@phase9` e2e: create-share → view → join-as-editor → collaborate → revoke; permission-boundary specs; `.ics` generation/labeling/timezone specs; rate-limit spec. Plus the two new guards (no-referral-gating, calendar-labeling) added to the always-on CI set alongside the Phase 5 ethics guards.

### Exit criteria
- ✅ All `@phase9` green; ✅ collaborator permission boundaries proven by tests; ✅ revocation effective ≤ 60s; ✅ `.ics` verified in Google + Apple + Outlook with Free availability and pretend labeling; ✅ zero referral gating; ✅ no calendar OAuth.

---

## PHASE 10 — Polish, Performance, Accessibility & Ethics Audit
**Objective:** ship-quality pass — budgets enforced, a11y complete, ethics audited, Capacitor-readiness proven.
**Prerequisites:** Phase 9.
**Estimate:** 3–4 days.

### Development tasks
1. Motion polish sweep of all DS §8 set-pieces (timing, overlap, easing) on real devices (iPhone, iPad, mid-tier Android).
2. Performance: verify GSAP/Rive/confetti are dynamic-imported; bundle-analyze (landing ≤ 130 KB gzip initial JS); image/art audit (`next/image`, AVIF/WebP, SVG-first); font subsetting confirmed; fix CLS sources (reserve space for boards/cards).
3. Full a11y pass: axe across every route; keyboard-only walkthrough of the entire booking flow; screen-reader spot checks (VoiceOver iOS) on countdown, board, pass; focus-visible everywhere; contrast re-verification both themes.
4. Full reduced-motion sweep: every animation checked against its variant (checklist from DS §8 catalog).
5. **Ethics audit (checklist, recorded in repo):** no payment fields (guards green); SIMULATION on all required surfaces incl. PDF + email; no dark patterns (no scarcity strings — automated grep for "only X left|hurry|expires soon"); notifications opt-in + capped; export/delete verified; share links revocable + collaborator boundaries enforced; calendar .ics labels pretend + Free availability; no referral gating; brand-blocklist DOM scans green; About page accurate.
6. Copy polish: warm, witty microcopy pass over all states (empty/error/toasts) per brand personality.
7. **Capacitor-readiness dry run:** `NEXT_PUBLIC_IS_NATIVE=true npm run build` (static export) succeeds; confirm no page hard-depends on Server Actions without a `lib/services` path; document any deltas in TS §12.
8. Final Lighthouse CI on production build: Perf ≥ 90, A11y ≥ 95, BP ≥ 95, PWA ✓ (mobile).
9. Release: version tag, `README.md` (setup, envs, scripts), deploy.

### QA test cases
| # | Test | Expected |
|---|------|----------|
| 10.1 | Lighthouse mobile (landing, results, checkout, trips) | Perf ≥ 90, A11y ≥ 95, BP ≥ 95, PWA ✓ on all four |
| 10.2 | Bundle budget | Landing initial JS ≤ 130 KB gzip; GSAP absent from landing chunk |
| 10.3 | Keyboard-only booking | Search→checkout→confirmation completable; visible focus throughout |
| 10.4 | Reduced-motion full sweep | Every DS §8 item has working variant (checklist 100%) |
| 10.5 | Dark-pattern grep | 0 scarcity/urgency strings |
| 10.6 | Ethics checklist | All items pass, signed off in `docs/ETHICS_AUDIT.md` |
| 10.7 | Static-export dry run | Build succeeds; app boots from `/out` against deployed API |
| 10.8 | CLS on results + checkout | < 0.05 |

### Regression tests (new features only)
- `@phase10`: the audit suites themselves (perf budgets, a11y sweep, ethics checklist, static-export build test) on the polished surfaces.

### Exit criteria
- ✅ All budgets + audits green; ✅ ethics audit signed off; ✅ static export proven; ✅ tagged release deployed.

---

## Timeline summary (solo dev + AI agent, part-time-friendly)
| Phase | Scope | Estimate |
|---|---|---|
| 0 | Scaffolding, tokens, CI | 2–3 days |
| 1 | Synthetic engine | 3–4 days |
| 2 | DB, auth, services | 3–4 days |
| 3 | Flight search/results/detail | 4–5 days |
| 4 | Hotels + trip summary | 2–3 days |
| 5 | Checkout, pass, email, stamp | 4–5 days |
| 6 | Trips, countdown, passport | 3–4 days |
| 7 | Itinerary, packing, AI, Explore/POIs, export | 5–6 days |
| 8 | PWA, push, memories | 3–4 days |
| 9 | Sharing, collaboration, calendar (.ics) | 4–5 days |
| 10 | Polish + audits | 3–4 days |
| **Total** | | **~36–47 dev-days** |

**MVP cut line:** Phases 0–6 = a complete, delightful MVP (PRD §7.1 minus itinerary/packing/push/memories). Phases 7–8 are Tier 2. Phase 9 (sharing/calendar) is Tier 2 as well. Ship after Phase 10's audit regardless of cut.
