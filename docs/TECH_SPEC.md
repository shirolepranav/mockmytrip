# WANDERLOST — Technical Specification

> Companion docs: `PRD.md`, `DESIGN_SYSTEM.md`, `APP_WORKFLOW.md`, `IMPLEMENTATION_PLAN.md`.

## 1. Stack Summary
- **Framework:** Next.js (App Router) 15/16, TypeScript (strict), React 19.
- **Styling:** Tailwind CSS v4 (CSS-first config) + design tokens as CSS variables. No component library shipped as-is (no stock shadcn look — see `DESIGN_SYSTEM.md`).
- **Animation:** **Motion** (`motion`, formerly Framer Motion) for UI/route/gesture; **GSAP** + `@gsap/react`'s `useGSAP` for signature timeline set-pieces (departure board, boarding-pass reveal); **canvas-confetti** for celebration bursts; optional **Rive** for the passport mascot; **Lottie** only if a specific pre-made asset is required.
- **DB:** Postgres on **Neon** (free tier: scale-to-zero after 5-min idle, first-class Vercel integration, HTTP serverless driver ideal for edge/serverless). Supabase is the alternative if bundled auth/storage is later desired.
- **ORM:** Drizzle ORM (lightweight, type-safe, edge-friendly, works cleanly with Neon).
- **Auth:** Passwordless magic-link (Auth.js/NextAuth Email provider) + guest mode via signed cookie. Minimal PII.
- **Email:** Resend + React Email templates.
- **PDF:** `@react-pdf/renderer` for the boarding pass; `qrcode` (→ PNG data URI) for the simulated barcode/QR (react-pdf's `Image` needs raster, not SVG).
- **PWA:** Serwist (`@serwist/next`) — the maintained successor to next-pwa.
- **Hosting:** Vercel (Hobby).
- **Testing:** Playwright (e2e), Vitest + React Testing Library (unit/component), Lighthouse CI (budgets), axe-core (a11y).

## 2. App Router Structure
```
app/
  (marketing)/
    page.tsx                 # landing
    about/page.tsx           # ethics/science
  (onboarding)/
    welcome/page.tsx         # simulation disclosure
  (app)/
    layout.tsx               # persistent SIMULATION badge, nav, theme
    search/
      flights/page.tsx
      flights/results/page.tsx
      hotels/page.tsx
      hotels/results/page.tsx
    flight/[id]/page.tsx
    hotel/[id]/page.tsx
    trip/
      summary/page.tsx
      checkout/page.tsx
      confirmation/[bookingId]/page.tsx
    trips/page.tsx           # my trips dashboard
    trips/[tripId]/page.tsx  # countdown + detail
    trips/[tripId]/itinerary/page.tsx
    trips/[tripId]/packing/page.tsx
    trips/[tripId]/memories/page.tsx
    passport/page.tsx
    settings/page.tsx
  api/
    boarding-pass/[bookingId]/route.ts   # PDF stream
    push/subscribe/route.ts
    push/send/route.ts                    # cron-triggered
  manifest.ts
  sw.ts                       # Serwist service worker
  template.tsx                # Motion page-transition wrapper
components/                   # design-system components
lib/
  engine/                     # synthetic data engine
    airports.ts distance.ts schedule.ts pricing.ts names.ts hotels.ts seed.ts
  services/                   # shared business logic (callable by Server Actions AND an external API)
  db/                         # drizzle schema + client
  email/
  auth/
  motion/                     # tokens, variants, spring configs, reduced-motion layer
actions/                      # server actions (web target) — thin wrappers over lib/services
data/                         # airports.seed.json, word banks, brand blocklist
```

## 3. Rendering Strategy
- Server Components by default for data/layout; Client Components (`"use client"`) only for interactivity (search form, animations, countdown, drag).
- **Mutations via Server Actions** for the web target (create booking, add itinerary item, etc.) with Zod validation and auth/ownership checks inside each action. **Architectural rule:** every mutation must also be reachable via a shared `lib/services/*` function so a static-export (Capacitor) build can call an external endpoint instead — never bury business logic solely inside Server Actions (see §12).
- Use `useOptimistic` / `useActionState` for instant feedback; `revalidatePath` / `revalidateTag` after mutations.
- Streaming + `loading.tsx` for the playful loading states.
- Search results are computed server-side (seeded, deterministic) and cached per query params.

## 4. Data Model / Schema (Drizzle / Postgres)
All ids `uuid` (pk, default `gen_random_uuid()`); timestamps `timestamptz` default `now()`.

- **users:** `id, email (nullable, unique), display_name, is_guest (bool), created_at, prefs_json (reduced_motion, theme, notif_opt_in), total_saved_cents (bigint, default 0)`.
- **airports** (seed, read-only): `id, ident, iata_code, icao_code, name, municipality, iso_country, iso_region, latitude_deg, longitude_deg, type, tz`. (From OurAirports.)
- **airlines** (seed/generated): `id, name, code (2-letter), hue, logo_seed`.
- **hotels** (seed/generated): `id, name, brand, city, iso_country, lat, lng, star_rating, hero_seed, amenities_json, nightly_base_cents`.
- **flights** (materialized per booking; ephemeral results are computed, not stored): `id, airline_id, flight_number, origin_airport_id, dest_airport_id, depart_at, arrive_at, duration_min, distance_km, cabin, stops, price_cents, seed`.
- **trips:** `id, user_id (fk), title, destination_city, cover_seed, start_date, end_date, status (upcoming|in_progress|memory), created_at`.
- **bookings:** `id, trip_id (fk), user_id, type (flight|hotel), flight_id (nullable), hotel_id (nullable), pnr (fake, e.g. SIM-XXXXXX), seat, gate, price_cents, saved_cents, created_at`.
- **passport_stamps:** `id, user_id, trip_id, country_iso, city, stamp_style, stamp_date, rotation_deg, ink_hue`.
- **pois** (seed, read-only, REAL places): `id, name, city, iso_country, lat, lng, category (sight|landmark|museum|restaurant|cafe|viewpoint|park), description, image_url (nullable), source (wikidata|wikivoyage|osm), source_id, attribution, rank`.
- **itinerary_items:** `id, trip_id, day_index, time (nullable), title, note, category (food|sight|activity|transit|rest), poi_id (nullable fk → pois), sort_order`.
- **packing_items:** `id, trip_id, label, category, is_checked (bool), sort_order, is_auto (bool)`.
- **trip_shares:** `id, trip_id (fk), owner_user_id (fk), token (unique, 22-char base62 from CSPRNG), permission ('view'|'edit'), is_revoked (bool, default false), expires_at (nullable), view_count (int), created_at`.
- **trip_collaborators:** `id, trip_id (fk), user_id (fk), role ('viewer'|'editor'), joined_via_share_id (fk nullable), notify_opt_in (bool, default false), created_at`. Unique on `(trip_id, user_id)`.
- **itinerary_items:** gains `created_by_user_id (fk)` so collaborative items show attribution ("added by Sam").
- **push_subscriptions:** `id, user_id, endpoint (unique), p256dh, auth, created_at`.
- **mood_checkins** (optional): `id, user_id, session_id, phase (before|after), score (1–5), created_at`.

**Indexes:** `airports(iata_code)`, `airports(municipality)`, `bookings(trip_id)`, `trips(user_id, status)`, `passport_stamps(user_id)`, `push_subscriptions(endpoint unique)`, `trip_shares(token unique)`, `trip_collaborators(user_id)`, `trip_collaborators(trip_id, user_id) unique`.

## 5. Synthetic Data Engine

### 5.1 Airport seed (OurAirports)
- **Source:** OurAirports public-domain `airports.csv` (repo `github.com/davidmegginson/ourairports-data`; mirror `davidmegginson.github.io/ourairports-data/airports.csv`; ~12.6 MB, updated nightly). Public domain (PDDL); no attribution required (credit on About anyway).
- **Columns used:** `ident, type, name, latitude_deg, longitude_deg, iso_country, iso_region, municipality, scheduled_service, icao_code, iata_code`.
- **Filter at seed time** to `type IN ('large_airport','medium_airport')` AND `scheduled_service = 'yes'` AND `iata_code` present (~a few thousand rows) → store in `airports` table + ship a slim JSON for client autocomplete (`iata, name, city, country, lat, lng`). Add IANA `tz` per airport via a lat/lng timezone lookup (e.g., `tz-lookup`) so local depart/arrive times are correct.

### 5.2 Fictional airline & hotel names
- **Airlines:** curated hand-authored list of ~40 plausible-but-fictional names (e.g., *Altair Airways, Meridian Pacific, Lumen Air, Cirrus Continental, Vela Airlines, Nimbus Skyways, Solstice Air, Halcyon Airlines, Aurora Transcontinental, Zephyr Jet*), each with a 2-letter code, brand hue, and a deterministic geometric SVG logo generated from `logo_seed`. Assign an airline to a route deterministically by hashing route+seed.
- **Hotels:** combinatorial generator `[Prefix] + [Core] + [Type]` from curated word banks (Prefix: *The, Grand, Maison, Casa, Hotel*; Core: evocative/locale/neighborhood words; Type: *Hotel, Residence, Suites, Lodge, Inn, House, Collection*), seeded by city+index. Star rating 3–5 weighted; nightly base by city cost tier.
- **All names checked against a real-brand blocklist** to avoid accidental collisions.

### 5.3 Flight time via great-circle distance
- **Haversine** (mean Earth radius **R = 6371 km**): `a = sin²(Δφ/2) + cos φ₁·cos φ₂·sin²(Δλ/2)`; `c = 2·asin(min(1, √a))`; `d = R·c`. The `min(1, …)` guards antipodal floating-point error. Accurate to ~0.5% (sufficient). Sanity check: JFK–LHR ≈ 5,540 km.
- **Block-time model:** `cruise_min = d / v * 60` with **v ≈ 875 km/h** for jets; for `d < 400 km` use a turboprop profile **v ≈ 550 km/h**. Add fixed overhead `taxi_climb_descent = 30 min`. `duration_min = round(cruise_min + overhead)`, snapped to the nearest 5 min.
- **Stops:** direct if `d < 4,500 km` OR route is "major"; otherwise probabilistically 1 stop with a 60–120 min synthetic layover through a hub chosen from a hub list.
- **Departure banks:** 3–8 departures/day drawn from realistic banks (early 06:00–09:00, midday 11:00–14:00, evening 17:00–21:00) with per-airline jitter; `arrive_at = depart_at + duration + tz_offset_delta`.

### 5.4 Pricing model
- `base = baseFarePerKm(distanceBand) × distance_km`, where the per-km rate **decreases** with distance: short-haul ~$0.22/km, medium ~$0.14/km, long-haul ~$0.09/km, ultra-long ~$0.07/km, with a **$39 floor**.
- `seasonality`: month multiplier + departure day-of-week factor (Fri/Sun peak), range ~0.8–1.5, plus a "days-until-departure" curve (closer = pricier).
- `cabin`: economy 1.0, premium 1.6, business 3.2, first 5.5.
- `jitter`: deterministic ±8% seeded by `hash(route+date+flightNo)` — stable within a session, varied across options.
- `final_price_cents = round(base × seasonality × dow × daysCurve × cabin × jitter)`. **"You saved" = this full price** (since the user pays $0).
- Hotels: `nightly = nightly_base × seasonality × star_factor × jitter`; total = nightly × nights.
- **All money is fake** and labeled simulated.

### 5.5 Determinism
A single `seed(query)` util (hash of normalized query params) drives all randomness so results are reproducible per search and identical across SSR and hydration.

### 5.6 Real POI data (Explore feature — sights & restaurants)
Unlike airlines/hotels, POIs are **real places**, sourced free at build time (no paid runtime APIs, matching the cached/synthetic philosophy):
- **Wikidata SPARQL:** entities that are instances/subclasses of tourist attraction, museum, landmark within N km of a city, ranked by **sitelink count** (a solid fame proxy); yields name, coordinates, description, and a Commons image. Licensing: data CC0; images per their Commons license.
- **Wikivoyage:** per-city "See / Do / Eat" listings for curated, human-quality picks (CC BY-SA — keep attribution if text is used).
- **OpenStreetMap via Overpass API:** `amenity=restaurant|cafe`, `tourism=attraction|viewpoint|museum` around city centers for restaurant/café density (ODbL — attribution required: "© OpenStreetMap contributors").
- **Seed script** `scripts/seed-pois.mts`: for each supported city (start with the top ~100 destination cities), pull, dedupe (name+distance), rank (Wikidata sitelinks first, then OSM prominence), keep top ~30–50, store in `pois` with `attribution` and `source_id`. Re-runnable; polite rate limiting; cached raw responses.
- **Rules:** never invent facts about real places; no synthetic ratings/reviews/prices on POIs; surface attribution on POI detail + About page; POI cards carry a "Real place" chip while any simulated price nearby keeps the SIMULATION label.
- **Runtime:** all POI reads are from our DB — zero third-party calls at request time, so free-tier safe and offline-cacheable.

## 6. Auth
- **Guest-first:** first visit creates a guest `users` row (or localStorage-only until first save) with a signed, httpOnly cookie session id.
- **Upgrade path:** magic-link email (Auth.js Email provider + Resend) links guest data to the account.
- No passwords. Server Actions/API check session and ownership before any mutation. Rate-limit magic-link requests.

## 7. Email Pipeline (boarding pass)
- On booking confirm: server action → insert booking → if the user provided an email, `resend.emails.send()` with a **React Email** template (route summary, fictional airline, PNR `SIM-XXXXXX`, prominent "This is a simulation — no travel is booked" banner) and the boarding-pass PDF attached.
- **PDF:** `/api/boarding-pass/[bookingId]` streams a styled PDF via `@react-pdf/renderer`. Barcode/QR via `qrcode` → PNG data URI embedded; the QR encodes a fake PNR prefixed `SIMULATION|`.
- **Resend free-tier limits:** 100 emails/day, 3,000/month, 10 req/s, 1 custom domain. Dedupe with an idempotency key per booking; degrade gracefully (the in-app pass is always available even if the email is skipped).

## 8. PWA Setup
- **Manifest** (`app/manifest.ts` returning `MetadataRoute.Manifest`): name "Wanderlost", short_name, `display: 'standalone'`, `background_color` + `theme_color` from brand tokens, maskable + standard icons (192, 512), `start_url: '/'`, `orientation: 'any'`.
- **Service worker (Serwist)** — `app/sw.ts`:
  ```ts
  const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true, clientsClaim: true, navigationPreload: true,
    runtimeCaching: defaultCache,
    fallbacks: { entries: [{ url: '/~offline', matcher: ({ request }) => request.mode === 'navigate' }] },
  });
  serwist.addEventListeners();
  ```
  `next.config` wrapped with `withSerwistInit({ swSrc: 'app/sw.ts', swDest: 'public/sw.js' })`. Disable the SW in dev.
- **Offline:** precache the app shell + slim airports JSON; `/~offline` fallback; My Trips readable offline from cache/IndexedDB; queue new saves.
- **Middleware allow-list:** exempt `/manifest.webmanifest`, `/sw.js`, `/workbox*` so auth middleware doesn't block PWA files.
- **Web push:** VAPID keys; `push_subscriptions` table; `/api/push/subscribe`; sending via Vercel Cron → `/api/push/send` for countdown milestones. **Opt-in only.** iOS supports web push only for home-screen-installed PWAs (iOS 16.4+).
- **Register the SW only on the web target** (guard with a native-platform check) so a future Capacitor build never tries to use it (see §12.5).

## 8b. Sharing, Collaboration & Calendar Export

### 8b.1 Share links
- **Token:** 22-char base62 from `crypto.randomUUID()`/CSPRNG bytes — unguessable, not sequential, never derived from `trip_id`. Stored in `trip_shares.token`.
- **Route:** `/s/[token]` — public, no auth required to *view*. Server Component resolves token → trip; returns 404-style "this dream has been tucked away" if `is_revoked` or expired.
- **Permissions:** `view` (read-only render) or `edit` (requires the visitor to sign in/guest-upgrade, then creates a `trip_collaborators` row with role `editor`).
- **Owner controls:** list active links, copy, toggle permission, revoke (sets `is_revoked`), remove a collaborator, downgrade editor→viewer. Revocation is immediate (checked per request, never cached beyond 60s).
- **Authorization helper:** extend `assertOwner` into `assertCanView(userId, tripId)` / `assertCanEdit(userId, tripId)` in `lib/services/access.ts`. Every itinerary mutation routes through `assertCanEdit`. Collaborators can mutate **only** `itinerary_items` for that trip — never bookings, trip deletion, other trips, or the owner's profile.
- **Privacy:** shared pages expose only the trip (route, dates, itinerary, destination art) and the owner's display name — never email, other trips, passport, or savings totals.
- **Abuse control:** rate-limit share creation (10/user/day) and `/s/[token]` lookups by IP; `view_count` for the owner's awareness only (no analytics on viewers).

### 8b.2 Collaboration semantics
- **Conflict model:** last-write-wins per item, matching the existing app-wide policy. Ordering conflicts resolved by re-normalizing `sort_order` on read. No realtime/CRDT layer in this tier — a lightweight poll (or `revalidateTag` on focus) is sufficient for planning-pace edits and keeps the app free-tier and Capacitor-friendly.
- **Attribution:** `itinerary_items.created_by_user_id` renders as "added by {name}" chips.
- **Notifications:** collaborators get countdown milestones **only** if `notify_opt_in` is true; the owner is never auto-notified of every edit (batched "3 new ideas from Sam" at most once/day).

### 8b.3 Calendar export (.ics — deliberately not the Google Calendar API)
Rationale: an `.ics` file works with Google Calendar, Apple Calendar, and Outlook at once, needs no OAuth, no Google Cloud project + verification, and no read access to the user's calendar — which is required by data minimalism (§11).
- **Route:** `api/calendar/[tripId]/route.ts` → `text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="wanderlost-{city}.ics"`. Auth + `assertCanView`.
- **Generation:** RFC 5545 via `ics` (or hand-built VCALENDAR). Emit a VEVENT for departure, one for return, and optionally all-day events per itinerary day.
- **Mandatory labeling fields:**
  - `SUMMARY:✈ (Pretend) {City} · Wanderlost`
  - `DESCRIPTION:` opens with "This is a SIMULATED trip from Wanderlost. No flights, hotels, or payments are real."
  - `TRANSP:TRANSPARENT` → shows as **Free**, never Busy, so colleagues checking availability are not misled.
  - `STATUS:TENTATIVE`; `UID` = `{bookingId}@wanderlost` (stable, so re-import updates rather than duplicates); `DTSTAMP` UTC; `LOCATION` = destination city.
  - No `ORGANIZER`/`ATTENDEE` (avoids invite emails); no alarms unless the user opts in.
- **Timezones:** emit `DTSTART;TZID=` with the destination airport's IANA tz (already seeded per §5.1) plus a `VTIMEZONE` block; all-day items use `VALUE=DATE`.
- **Native path:** on a future Capacitor build, write the `.ics` via `@capacitor/filesystem` and open with the system handler — same file, no API change.

## 9. Performance Budgets
- Landing initial JS ≤ 130 KB gzip; route chunks lazy-loaded; **GSAP/Rive dynamically imported only on routes that use them.**
- LCP < 2.0s on mid-tier mobile/4G; CLS < 0.05; INP < 200ms; TTI < 3.5s.
- Lighthouse (mobile) targets: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, PWA installable ✓.
- Images via `next/image` (AVIF/WebP); seeded SVG/procedural art preferred over photos.
- Animations run on transform/opacity (GPU); no layout thrash; confetti particle count capped on mobile.

## 10. Accessibility
- WCAG 2.2 AA. Semantic HTML, labeled inputs, focus-visible rings, logical tab order, skip link.
- Targets ≥ 44×44px; safe-area insets (`env(safe-area-inset-*)`).
- `prefers-reduced-motion` honored globally via the motion-token layer; manual toggle in Settings.
- Color contrast AA; never color-only signaling; departure-board and stamps have text equivalents / `aria-live`.
- Countdown announces day changes only (`aria-live="polite"`), not every second.

## 11. Security & Privacy
- Data minimalism: optional email + user content only; **no payment data ever**; no third-party trackers/ads.
- Zod validation on all inputs (client + server). Server Actions have same-origin CSRF protection by default plus explicit auth/ownership checks.
- httpOnly, secure, sameSite cookies; secure headers via `next.config`; escape all rendered synthetic content.
- Data export (JSON) + hard delete in Settings; delete cascades user rows.
- Secrets in env (`RESEND_API_KEY`, `DATABASE_URL`, `VAPID_*`, `LLM_API_KEY`); only `NEXT_PUBLIC_*` reaches the client.

## 12. Capacitor Compatibility (future iOS wrap — do not preclude)
**Latest: Capacitor 8** (SPM default for new iOS projects; requires Xcode 26.0+ and Node.js 22+). Architect now so the wrap is a config step, not a rewrite.

### 12.1 Static-export readiness
A future mobile build uses Next.js `output: 'export'` (writes `/out`), `images: { unoptimized: true }`, `trailingSlash: true`. Under static export the following **do not work**: **Server Actions, Route Handlers/API routes, middleware, dynamic server rendering (`cookies()/headers()`), and ISR.** Therefore keep the canonical data path client → external API: implement mutations as Server Actions for the web target *but back each with a shared `lib/services/*` function* so the mobile build talks to the live Wanderlost API over the network.

### 12.2 Dual-target build toggle
```ts
const isNative = process.env.NEXT_PUBLIC_IS_NATIVE === 'true';
const nextConfig: NextConfig = {
  ...(isNative ? { output: 'export', images: { unoptimized: true }, trailingSlash: true } : {}),
};
```
The web deploy keeps SSR/Server Actions; `npm run mobile` sets the flag, builds static, then runs `npx cap sync`. `capacitor.config.ts`: `{ appId, appName, webDir: 'out' }`.

### 12.3 Platform gating
Use `Capacitor.isNativePlatform()` / `Capacitor.getPlatform()` to branch web-only features (SW registration, web push, PWA install prompt) versus native plugins.

### 12.4 Native plugins mapped to features
- `@capacitor/push-notifications` (APNs/FCM) replaces web push inside the app.
- `@capacitor/local-notifications` for countdown reminders.
- `@capacitor/filesystem` (`writeFile` base64 → `Directory.Documents`) to save the boarding-pass PDF; `@capacitor/share` to share it.
- `@capacitor/preferences` for lightweight key/value (replaces localStorage on native).

### 12.5 Gotchas
- **Service workers do not run reliably in the iOS WKWebView** — do NOT depend on Serwist/Workbox for offline or push inside the native app; use native plugins. Keep the SW strictly a web-PWA enhancement, gated off on native.
- **`server.url` is not intended for production** (App Store rejection risk); bundle static assets locally. For OTA web-layer updates later, use a live-update plugin (e.g., Capgo), not `server.url`.

### 12.6 Phase 10 static-export dry-run findings (`npm run mobile`)

Ran `NEXT_PUBLIC_IS_NATIVE=true next build` after all of Phase 10's web-only
additions (security headers, robots/sitemap/OG images, Sentry, privacy
page) to confirm nothing broke static-export compatibility, and to
empirically test §12.1's claims against the current Next.js 16.2.12. Actual
findings, more precise than §12.1's summary:

**Confirmed no-op, exactly as expected:**
- `headers()` in `next.config.ts` is skipped on the native branch already
  (never reaches `output: "export"` — Next.js errors if the two are
  combined, so this has to be branch-guarded, not just discovered here).
- Sentry's server-side `instrumentation.ts` init is skipped via the same
  `NEXT_PUBLIC_IS_NATIVE` check; the client-side init
  (`instrumentation-client.ts`) is also skipped there — no DSN, no
  init call, no-op on native.
- `app/dev/layout.tsx`'s `notFound()` guard is a plain React check
  (`NODE_ENV === "production"`), no server/config dependency — works
  identically under static export.
- `app/global-error.tsx` is a React error boundary, not server-dependent —
  works identically under static export.

**Needed a small, genuinely-static fix (`export const dynamic =
"force-static"`):** file-convention routes with **no dynamic segment** that
are static in substance but Next.js requires an explicit opt-in for under
`output: "export"`: `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`,
`app/opengraph-image.tsx`, `app/twitter-image.tsx`. These now build and
work correctly under static export — a real Capacitor build gets a working
manifest/robots/sitemap/OG image baked in at build time.

**Cannot work under static export at all (confirmed empirically, not just
asserted from §12.1's general rule) — and, critically, cannot be forced to
build via a quick per-route config fix without breaking the real web
deploy:**

The first pass at this dry run tried adding `export const dynamic =
"force-static"` (and, for dynamic-segment routes, also
`generateStaticParams() { return []; }`) to every route that blocked the
build, purely to get `next build --output=export` to finish. **That was
wrong and got reverted.** `dynamic`/`generateStaticParams` are ordinary
file-level exports — they are not conditional on `NEXT_PUBLIC_IS_NATIVE`
and apply identically to the real web build. Verified empirically before
reverting:
- With `force-static` on `app/auth/verify/route.ts`, a rebuilt **web**
  server started returning a frozen, build-time-baked redirect
  (`Location: http://localhost:3000/settings?auth=invalid`, the wrong
  port, ignoring the actual request) for every visit, regardless of the
  real token or host — magic-link sign-in would have been silently broken
  in production.
- With `generateStaticParams() { return []; }` alone (no `force-static`)
  on `app/(app)/flight/[id]/page.tsx`, a rebuilt **web** server threw
  `DYNAMIC_SERVER_USAGE` on every real request — adding
  `generateStaticParams` was enough by itself to make Next attempt static
  generation for a page that calls `readSessionUserId()` (`cookies()`),
  which static generation cannot do.

Both were reverted; none of the routes below carry any Phase 10 changes.
`npm run mobile` fails to complete for them, and that failure is the
correct, expected state — not a Phase 10 regression, and not something a
route-level export can safely paper over:

- `app/auth/verify/route.ts` — reads a live request's `?token=` query
  param and writes a `Set-Cookie` response header.
- `app/api/export`, `app/api/push/subscribe`, `app/api/push/send` — each
  reads the live session cookie or a cron auth header.
- `app/api/calendar/[tripId]`, `app/api/boarding-pass/[bookingId]`,
  `app/api/itinerary/[tripId]/pdf`, and the equivalent **pages**
  `app/(app)/flight/[id]`, `app/(app)/hotel/[id]`,
  `app/(app)/trip/confirmation/[bookingId]`, `app/(app)/trips/[tripId]`,
  `app/(app)/explore/[city]`, `app/s/[token]` — each has a dynamic path
  segment (`tripId`/`bookingId`/`id`/`token`) with no fixed build-time set
  (they're per-user database rows or query-derived offers), which trips a
  separate, sharper limit: Next's static-export validator
  (`next/dist/build/index.js`, error code `E87`) requires
  `generateStaticParams()` to return **at least one** param object —
  `return []` doesn't satisfy it (`prerenderedRoutes.length > 0` is the
  literal check) — and, as confirmed above, returning a real value isn't
  an option either without breaking the web build.

**What this actually means for a future real Capacitor wrap:** the routes
above are not a bug to fix — they're the concrete shape of the "keep the
canonical data path client → external API" guidance
§12.1 already gives, now backed by a specific list. A real native build
needs those specific pages/routes converted to **static shells that fetch
their per-user data client-side from the deployed Wanderlost API** after
mount (using the exact `lib/services/*` functions they already call
server-side, exposed over HTTP) rather than reading `params.tripId` /
`readSessionUserId()` at render time. That conversion — not a config flag
— is the real remaining Capacitor work, and per this project's current
scope it's deliberately **out of scope for Phase 10** (Phase 10 proves the
dry run surfaces exactly this, and stops there; the actual native wrap is
future work, Tier 3 per `docs/PRD.md` §7.3).

**Bottom line:** `npm run mobile` (Turbopack, no `--webpack`) succeeds for
the entire static/marketing/content surface of the app (landing, about,
privacy, welcome, robots/sitemap/manifest/OG images, the `/dev` guard, the
global error boundary). It does **not** currently produce a working
`/out` for the seven session/param-dependent routes listed above — that's
expected given the app's architecture (Server Components reading the DB
directly), not a regression, and the fix is the client-fetch-shell
conversion described above, not a smaller patch.

## 13. Key Decisions & Rationale
- **Neon over Supabase:** scale-to-zero after 5 min idle, generous project count, first-class Vercel integration, HTTP driver for edge/serverless. Supabase only if bundled auth/storage/realtime is later wanted.
- **Motion + GSAP together, not either/or:** Motion is declarative and React-native for UI/route/gesture; GSAP owns millisecond-precise timeline set-pieces. Never animate the same property on the same element with both. GSAP is fully free since 2025.
- **Rive is optional, Tier 3:** better for an interactive mascot but adds a ~200 KB WASM runtime and doesn't run in iOS WKWebView; must never be a hard dependency.
- **Serwist over next-pwa:** next-pwa is effectively unmaintained; Serwist is the supported successor.
- **Ethics enforced by tests, not prose:** the "no payment field" DOM assertion and "SIMULATION present" checks are CI gates on any checkout/pass/email change.
