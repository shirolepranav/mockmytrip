# Wanderlost

Wanderlost is a "travel dopamine" **simulation**. Search real airports,
"book" fake flights and hotels priced by a synthetic engine, pay **$0.00
with no payment fields, ever**, and savor the anticipation — countdown,
passport stamps, itinerary, packing, memories. Nothing here is real, on
purpose: research on well-being consistently finds that anticipating a trip
brings more lasting happiness than the trip itself. Wanderlost is built
entirely around that anticipation, without ever asking for a real dollar.

See [`app/(app)/about/page.tsx`](<app/(app)/about/page.tsx>) for the full
ethics pledge, and `docs/` for the product/technical spec this app was built
from (`PRD.md`, `TECH_SPEC.md`, `DESIGN_SYSTEM.md`, `APP_WORKFLOW.md`,
`IMPLEMENTATION_PLAN.md`, `ETHICS_AUDIT.md`).

## Prerequisites

- Node.js ≥ 22 (matches CI — see `.github/workflows/ci.yml`)
- npm (the repo is developed and CI-tested with npm; other package managers
  aren't verified)

No database, email, or API keys are required to run the app locally — see
[Environment variables](#environment-variables) below.

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With `.env.local`
empty, the app runs entirely on free-tier fallbacks: an embedded PGlite
database instead of Postgres, no outbound email, no AI suggestions, no push
notifications. Fill in the variables below as you need the real thing.

## Environment variables

All variables are optional for local development — the app degrades
gracefully when any of them are unset. Copy `.env.example` to `.env.local`
and fill in only what you need.

| Variable | Required in production? | What breaks if unset |
|---|---|---|
| `DATABASE_URL` | Yes | Falls back to an embedded PGlite database (fine for local dev/CI, not for a real deploy) |
| `AUTH_SECRET` | **Yes — hard requirement** | The app refuses to boot in production without it (`instrumentation.ts`); in dev it falls back to an insecure default |
| `RESEND_API_KEY` / `EMAIL_FROM` | No | Bookings still succeed; the confirmation email is skipped and the boarding pass stays viewable in-app |
| `LLM_API_KEY` / `ANTHROPIC_API_KEY` | No | The "AI suggest itinerary" feature shows a friendly unavailable message; manual itinerary authoring is unaffected |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | No | The push-notification opt-in shows a "not available" state |
| `CRON_SECRET` | No (yes if using the Vercel Cron job) | `/api/push/send` always returns 401 and no scheduled pushes are sent |
| `NEXT_PUBLIC_SITE_URL` | Recommended | `metadataBase`, `robots.txt`, `sitemap.xml`, and OG images fall back to `https://wanderlost.app` |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Recommended | Sentry.init() is skipped; errors are only visible in server logs |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | No | Build-time source-map upload to Sentry is skipped |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build (forced to classic Webpack — `@serwist/next` isn't Turbopack-compatible yet) |
| `npm run analyze` | Production build with the bundle analyzer open (`ANALYZE=true`) — used to verify the landing-page JS budget |
| `npm run mobile` | Static-export dry run for the future Capacitor wrap (`NEXT_PUBLIC_IS_NATIVE=true`) — see `docs/TECH_SPEC.md` §12 |
| `npm run start` | Start the production server (after `npm run build`) |
| `npm run lint` | ESLint |
| `npm run lint:styles` | Banned-styles gate — no raw hex/spacing outside the token files |
| `npm run lint:ethics` | Referral-gating guard — sharing must never gate a feature |
| `npm run lint:dark-patterns` | False-scarcity/urgency copy guard |
| `npm run format` | Prettier, writes in place |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit/component tests (Vitest) |
| `npm run e2e` | Full Playwright suite (use `-- --grep @phaseN` to scope to one phase) |
| `npm run test:a11y` | Axe accessibility assertions only (`-- --grep @a11y`) |
| `npm run lh` | Lighthouse CI against the production build |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:generate` | Generate a new migration from schema changes |
| `npm run db:seed` | Seed core data (airports, etc.) |
| `npm run db:seed-pois` | Seed real points-of-interest data for Explore (OSM/Wikidata/Wikivoyage) |

## Architecture

- **Framework**: Next.js App Router + TypeScript (strict) + React 19 +
  Tailwind v4. Server Components by default; Client Components only where
  interactivity requires it.
- **Mutations**: Server Actions, each backed by a shared `lib/services/*`
  function — so the same logic can be called from a future static-export
  (Capacitor) build via an external API, not just from a Server Action.
- **Synthetic engine**: `lib/engine/*` (airports, distance, schedules,
  pricing, name generation, hotels) — deterministic via seed, no real
  airline/hotel brands (enforced by a blocklist).
- **Database**: Neon Postgres + Drizzle (`lib/db`). Falls back to an
  embedded PGlite database when `DATABASE_URL` is unset.
- **Auth**: guest-first + magic link. This is a **hand-rolled** session
  system, not Auth.js/NextAuth — an HMAC-signed cookie
  (`lib/auth/session.ts`) plus a token-issuance service
  (`lib/services/auth.ts`). There is deliberately no `middleware.ts`; the
  session cookie is read inside Server Actions/Route Handlers/Server
  Components instead, which keeps the app safe to statically export later.
- **Email**: Resend + React Email. **PDF**: `@react-pdf/renderer` + qrcode.
  **PWA**: Serwist (`app/sw.ts`, `app/manifest.ts`).
- **Animation**: Motion for UI/route/gesture transitions; GSAP (+
  `useGSAP`) for larger set-pieces; canvas-confetti; Rive optional. GSAP,
  confetti, and Rive are all dynamic-imported so they never bloat the
  initial JS payload.
- **Error tracking**: Sentry (`instrumentation.ts`,
  `instrumentation-client.ts`, `app/global-error.tsx`) — crash/error
  reporting only. No Session Replay, no analytics or behavior-tracking
  products; PII is stripped before events are sent. This app does not use
  any third-party analytics or ad trackers, full stop.

## Deployment

Wanderlost targets **Vercel**. In the Vercel project settings:

1. Set `DATABASE_URL` (a Neon Postgres connection string), `AUTH_SECRET`
   (any long random string — e.g. `openssl rand -hex 32`), and
   `NEXT_PUBLIC_SITE_URL` (your production URL) as environment variables.
2. Optionally set `RESEND_API_KEY`/`EMAIL_FROM`, `LLM_API_KEY`,
   `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, and the Sentry variables — the
   app runs without them, just with those features disabled.
3. Set `CRON_SECRET` if you want the hourly push-digest cron
   (`vercel.json` schedules `/api/push/send`) to actually authenticate.
4. `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` should be set as
   **build-time** secrets only (never exposed to the client) — they enable
   source-map upload during `next build`.
5. The Content-Security-Policy ships as `Content-Security-Policy-Report-Only`
   by default (see `next.config.ts`); set `CSP_ENFORCE=true` once you've
   smoke-tested every route against the policy to switch it to enforcing.

Run migrations against the production database with `npm run db:migrate`
before the first deploy.

## Testing

- `npm run test` — unit/component tests (Vitest).
- `npm run e2e -- --grep @phaseN` — the Playwright regression suite for one
  phase (each feature phase ships tagged this way per
  `docs/IMPLEMENTATION_PLAN.md`).
- The **ethics guards** (`e2e/ethics/*` — no payment fields, SIMULATION
  label present, no referral gating, calendar labeling, brand-blocklist
  scan) run in CI on every commit, regardless of phase.
- `npm run lh` — Lighthouse budgets (Perf ≥ 90, A11y ≥ 95, Best Practices ≥
  95, PWA installable) against a production build.
