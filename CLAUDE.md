# Wanderlost — CLAUDE.md

Wanderlost is a "travel dopamine" SIMULATION web app. Users search real airports,
"book" fake flights/hotels priced by a synthetic engine, pay **$0.00 with no payment
fields ever**, and savor the anticipation (countdown, passport stamps, itinerary,
packing, memories). Nothing is real. It maximizes the well-documented happiness of
*anticipating* travel, ethically.

Canonical docs: `docs/PRD.md`, `docs/TECH_SPEC.md`, `docs/DESIGN_SYSTEM.md`,
`docs/APP_WORKFLOW.md`, `docs/IMPLEMENTATION_PLAN.md`. When in doubt, those win.

## Golden rules (NEVER violate)
1. NEVER add payment/card/CVV/billing fields or any payment SDK. Checkout is always $0.00.
2. NEVER remove or hide the persistent "SIMULATION" label (screens, checkout, boarding pass, email, PDF).
3. NEVER add dark patterns: no punishing streaks, no false scarcity ("2 seats left"),
   no countdown-to-book pressure, no confirm-shaming, no auto-opt-in notifications.
4. NEVER impersonate real airlines/hotels/brands. All bookable names fictional; keep the
   real-brand blocklist enforced in the name generator. EXCEPTION: POIs (sights/restaurants
   in Explore) are REAL places from open data — label them "Real place", never attach fake
   prices/ratings/reviews to them, and always keep source attribution (OSM ODbL, CC BY-SA).
5. ALWAYS use design tokens (CSS variables) — never hardcode hex, spacing, or radii.
6. ALWAYS include a reduced-motion variant for every animation, in the same change.
7. Data minimalism: only optional email + user content. Export & delete must always work.
8. NEVER gate features behind sharing ("invite 3 friends to unlock…" is banned). Sharing exists
   because it's useful; signups are a byproduct, not a growth mechanic.
9. Calendar exports (.ics) MUST self-label as pretend in the SUMMARY, open the DESCRIPTION with the
   simulation disclaimer, and set TRANSP:TRANSPARENT (Free, never Busy). Never request Google Calendar
   OAuth or any calendar-read scope — .ics only.
10. Shared trip pages (/s/[token]) MUST show the SIMULATION label above the fold and must never expose
   the owner's email, other trips, passport, or savings. Collaborators can edit ONLY itinerary_items.

## Commands
- Dev: `npm run dev`
- Build (web): `npm run build`
- Build (mobile/static-export dry run): `npm run mobile` (sets NEXT_PUBLIC_IS_NATIVE=true)
- Lint/format: `npm run lint` / `npm run format`
- Unit/component tests: `npm run test`
- E2E: `npm run e2e` (Playwright; use `--grep @phaseN` for phase-scoped regression)
- A11y: `npm run test:a11y` (axe)
- Lighthouse budgets: `npm run lh`
- DB migrate/seed: `npm run db:migrate` / `npm run db:seed`

## Architecture
- Next.js App Router + TypeScript (strict) + React 19 + Tailwind v4.
- Server Components by default; Client Components only for interactivity.
- Mutations: Server Actions (web) with Zod + auth/ownership checks — BUT back each with a
  shared `lib/services/*` function so a static-export (Capacitor) build can call an external API.
  Do NOT put business logic only inside Server Actions.
- Synthetic engine in `lib/engine/*` (airports/distance/schedule/pricing/names/hotels), deterministic via seed.
- DB: Neon Postgres + Drizzle (`lib/db`). Auth: guest-first + magic link (Auth.js + Resend).
- Email: Resend + React Email. PDF: @react-pdf/renderer + qrcode. PWA: Serwist (`app/sw.ts`, `app/manifest.ts`).
- Animation: Motion for UI/route/gesture; GSAP (+ useGSAP) for set-pieces; canvas-confetti; Rive optional.
  Dynamic-import GSAP/Rive/confetti so they don't bloat initial JS.

## Code style
- TypeScript strict; no `any`. Zod for all external input. Prefer server-side data.
- Components small and composable; colocate tests; kebab-case files, PascalCase components.
- Tailwind utilities driven by tokens; no ad-hoc colors. Use the clamp() type scale.
- Accessibility: semantic HTML, labeled inputs, focus-visible, 44px targets, AA contrast.
- Comments: clear but concise, understandable by amateur developers.

## Design-system enforcement
- NEVER use default shadcn styling. If a Radix/shadcn primitive is used, fully restyle with tokens.
- BANNED: Inter/Roboto/Arial/system-ui/Space Grotesk as display; purple→blue gradients;
  uniform 16px radius everywhere; emoji as UI icons; stock/AI hero photos; three identical cards as hero.
- Use the retro-travel identity: Clash Display (fallback Bricolage Grotesque) display, Fraunces serif accents,
  Hanken Grotesk body, Martian Mono for boards/countdown. Flat offset shadows, ticket die-cuts, paper grain.
- See skills: design-system, playful-animations, synthetic-data, ethical-guardrails.

## Testing conventions
- Every feature ships with unit/component tests + at least one Playwright e2e (happy path + key edge case),
  tagged `@phaseN` per docs/IMPLEMENTATION_PLAN.md.
- REGRESSION SCOPE: run regression tests ONLY on the features introduced in the current phase
  (`npm run e2e -- --grep @phaseN`), not the whole app. Exception: the ethics guard tests
  (no-payment-field, SIMULATION-present) run on EVERY commit from Phase 5 onward.
- Meet Lighthouse mobile budgets: Perf ≥ 90, A11y ≥ 95, BP ≥ 95, PWA installable.

## Workflow guidance
- Plan before coding; keep diffs small and scoped to the current phase; respect phase exit criteria.
- When adding animation, add its reduced-motion variant in the same change.
- When touching checkout/boarding pass/email, re-run the ethics guard tests.
- Prefer procedural/seeded SVG art over images. Mobile-first (test 390px + iPad widths).
- Stay free-tier: mind Resend (100/day, 3,000/mo), Neon scale-to-zero, LLM quota + fallback.
