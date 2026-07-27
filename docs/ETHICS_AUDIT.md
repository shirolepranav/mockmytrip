# Ethics Audit — Phase 10

Signed-off checklist for `docs/IMPLEMENTATION_PLAN.md` Phase 10 task 5 /
QA 10.5–10.6, mirroring CLAUDE.md's 10 golden rules. Each row cites the
concrete evidence enforcing it — this doc should never assert anything the
cited file doesn't actually test.

| # | Golden rule | Evidence | Status |
|---|---|---|---|
| 1 | No payment/card/CVV/billing fields or payment SDK; checkout always $0.00 | `e2e/ethics/no-payment-fields.spec.ts` | ✅ Pass |
| 2 | Persistent "SIMULATION" label on all required surfaces (screens, checkout, boarding pass, email, PDF) | `e2e/ethics/simulation-present.spec.ts` | ✅ Pass |
| 3 | No dark patterns: no punishing streaks, no false scarcity, no countdown-to-book pressure, no confirm-shaming, no auto-opt-in notifications | `scripts/check-no-dark-patterns.mjs` (`npm run lint:dark-patterns`, new this phase) | ✅ Pass — 0 violations across `app/`, `components/`, `lib/`, `actions/` |
| 4 | No real airline/hotel brand impersonation; POIs are real places, clearly labeled, never given fake prices/ratings | `lib/engine/names.ts` + `lib/engine/engine.test.ts` (`@phase1` brand blocklist), `e2e/phase4-hotels.spec.ts`, `e2e/ethics/brand-blocklist-scan.spec.ts` (new this phase — standing `@ethics` gate, not just a phase-scoped spot check) | ✅ Pass |
| 5 | Design tokens only — no hardcoded hex/spacing/radii | `scripts/check-banned-styles.mjs` (`npm run lint:styles`) | ✅ Pass — all Phase 10 additions (privacy page, OG image, global-error) use token utilities or the `lib/design/colors.ts` mirror |
| 6 | Reduced-motion variant for every animation | Manual audit this phase (see below) | ✅ Pass — no gaps found |
| 7 | Data minimalism: only optional email + user content; export/delete always work | `app/api/export/route.ts`, `components/delete-all-button.tsx`, manual verification via `/settings` | ✅ Pass |
| 8 | No referral gating — sharing is never a growth mechanic | `scripts/check-no-referral-gating.mjs` (`npm run lint:ethics`), `e2e/ethics/no-referral-gating.spec.ts` | ✅ Pass |
| 9 | Calendar `.ics` self-labels as pretend, `TRANSP:TRANSPARENT`, no Google Calendar OAuth | `e2e/ethics/calendar-labeling.spec.ts` | ✅ Pass |
| 10 | Shared trip pages (`/s/[token]`) show SIMULATION above the fold, never expose owner email/other trips/passport/savings; collaborators edit only `itinerary_items` | Phase 9 e2e specs (`e2e/phase9-sharing.spec.ts`) | ✅ Pass |
| — | About/Privacy pages accurate about what's real vs. fictional, and about actual data handling | Manual copy review against the codebase (see below) | ✅ Pass |

## Automated gates (run on every commit from Phase 10 onward)

`npm run lint:ethics` (referral gating) and `npm run lint:dark-patterns`
(false scarcity/urgency) both run in CI's `quality` job. `e2e/ethics --grep
"@ethics"` runs in CI's `e2e` job on every commit — this now includes the
new `brand-blocklist-scan.spec.ts`.

## New this phase: privacy page accuracy

`app/(app)/privacy/page.tsx` names every subprocessor the app actually
uses, checked against real code, not aspiration:
- **Neon** (`lib/db/client.ts`), **Vercel** (deploy target),
  **Resend** (`lib/services/bookings.ts`'s email step, skipped without
  `RESEND_API_KEY`), **Anthropic** (`lib/services/ai.ts`, skipped without
  a key), **Sentry** (`instrumentation.ts`/`instrumentation-client.ts`,
  skipped without a DSN).
- Cookie claim (`wl_session`, ~13 months, httpOnly) matches
  `lib/auth/session.ts`'s `MAX_AGE_SECONDS` and `establishSession()`
  exactly.
- Sentry is described as "no session replay, no behavior analytics" —
  verified true: `instrumentation-client.ts` never imports
  `replayIntegration`, and both init calls set `sendDefaultPii: false`
  plus a `beforeSend` that strips cookies/headers and reduces `user` to
  an opaque id (`instrumentation.ts`).

## Reduced-motion sweep

Audited `lib/motion/reduced-motion.tsx`'s `useMotionPrefs()` adoption
against `docs/DESIGN_SYSTEM.md` §8's animation catalog:
- 24 components consume `useMotionPrefs()`, covering every major set-piece:
  departure board, boarding-pass reveal, countdown flip, passport-stamp
  entrance, paper-plane loader, savings tally, toast/undo-toast, sheet,
  toggle switch, memory postcard, packing list, page transitions
  (`app/template.tsx`).
- GSAP + canvas-confetti in `boarding-pass-reveal.tsx` are gated behind
  `shouldAnimate = autoPlay && !reduced` — reduced motion skips the
  dynamic import entirely, not just the visual playback.
- `airport-autocomplete.tsx`'s chip animation uses the CSS-variant path
  (`document.documentElement.dataset.motion`, consumed via Tailwind's
  `[html[data-motion=reduced]_&]:` arbitrary variant) instead of the hook —
  a second, equally valid mechanism the provider explicitly supports.
- No bare `:focus` usage found anywhere (`grep -rn ":focus\b"` across
  `app`/`components` — only `:focus-visible`/`:focus-within`).

## Bundle budget (QA 10.2) — partial pass, gap documented honestly

Landing page (`/`) initial JS, measured directly from the production
server's served `<script>` tags (gzip, summed per-file — the accurate
over-the-wire figure, not a single combined-gzip estimate):

- **Before this phase's Sentry fix: ~290 KB gzip.** Sentry's client SDK
  (`@sentry/nextjs`) was statically imported in `instrumentation-client.ts`
  and `app/global-error.tsx`; webpack module-concatenates its ~140
  internal modules into one inseparable chunk, so neither named imports
  nor `import * as Sentry` tree-shaking helped.
- **Fix applied:** dynamically `import("@sentry/nextjs")` inside the same
  guard (`instrumentation-client.ts`), matching the existing GSAP/confetti
  pattern CLAUDE.md already requires. Confirmed via the served-script-tags
  diff: Sentry's ~140 KB chunk no longer loads eagerly; only a ~15 KB stub
  remains in the initial bundle.
- **Current total: ~230 KB gzip — still over the 130 KB budget.**
  Confirmed via the bundle analyzer (`npm run analyze`) that the two
  largest remaining contributors are the React 19 / Next.js 16 App Router
  runtime itself (`react-dom-client.production.js` ~63 KB gzip +
  `react-server-dom-webpack`/router runtime ~63 KB gzip — framework cost,
  not app code) and Framer Motion's full bundle (~42 KB gzip, used for
  page transitions in `app/template.tsx` and `countdown-flip.tsx`).
  GSAP and canvas-confetti are confirmed **absent** from the landing
  chunk (verified: neither string appears in the landing/layout/template
  chunks, and the two chunks that do contain GSAP are never referenced
  from the landing route's chunk graph) — that specific QA 10.2
  requirement is met.
- **Not fixed in this pass:** closing the remaining ~100 KB gap would need
  a LazyMotion/`m`-component migration for Framer Motion across the whole
  animation system (`app/template.tsx` plus every `useMotionPrefs()`
  consumer) — a cross-cutting refactor of a carefully-tuned, 9-phase-old
  animation system, with real regression risk, and out of proportion for
  a polish-phase side-fix. Recorded here as known follow-up work rather
  than silently claimed as met.

## Lighthouse CI (QA 10.1) — now actually wired and running

`lighthouserc.json` existed since an earlier phase but was **never wired
into CI** and, once actually run in Phase 10, turned out to have two real
bugs that had been silently hiding both true results the whole time:

1. `settings.preset: "perf"` restricts Lighthouse to performance audits
   only — accessibility and best-practices always reported "0 audits ran"
   instead of a real score. Removed; both categories run properly now.
2. The CSP (this phase's own addition, §1) included
   `upgrade-insecure-requests`, which Chrome logs as a console
   error/DevTools Issue when delivered in a Report-Only policy — directly
   failing the `errors-in-console` and `inspector-issues` best-practices
   audits. Fixed: that directive now only ships once `CSP_ENFORCE=true`
   (see `next.config.ts`).

With both fixed, an actual local `npm run lh` run (production build,
fixture-authenticated `/trip/checkout` and `/trips` via
`scripts/seed-lighthouse-fixture.mts`) against all 4 target URLs (`/`,
flight results, checkout, trips) scores:

| URL | Performance (≥0.90) | Accessibility (≥0.95) | Best Practices (≥0.95) |
|---|---|---|---|
| `/` | 0.85 ✗ | ✅ pass | ✅ pass |
| flight results | 0.83 ✗ | ✅ pass | ✅ pass |
| `/trip/checkout` | 0.86 ✗ | ✅ pass | ✅ pass |
| `/trips` | 0.86 ✗ | ✅ pass | ✅ pass |

Accessibility and Best Practices are genuinely green everywhere.
Performance fails on every route, consistent with — not separate from —
the bundle-budget gap already documented above (React/Next runtime +
Framer Motion overhead on top of the 130 KB target). The new `lighthouse`
CI job (`.github/workflows/ci.yml`) is wired as a real, currently-failing
gate — deliberately not loosened or made non-blocking to hide this. PWA:
no `categories:pwa` assertion exists to make (Lighthouse removed the
aggregate PWA category upstream in v11+, confirmed absent from this
project's Lighthouse 12.6.1); installability is covered instead by
`e2e/phase8-pwa-offline.spec.ts`.

## Capacitor dry run (QA 10.7)

See `docs/TECH_SPEC.md` §12.6 for the full findings. Summary: the
static/content surface of the app builds and works correctly under
`output: "export"`. Seven session/param-dependent routes (magic-link
verify, data export, push subscribe/send, calendar/boarding-pass/itinerary
PDF export, and six pages reading per-user IDs) cannot be — confirmed
empirically, including two attempted workarounds (`force-static`,
`generateStaticParams`) that were tried, found to break the routes in the
**real web build**, and reverted. This is accurately documented as
expected, architecturally-driven behavior, not a regression.

## Sign-off

All CI-enforced ethics gates (rows 1–10 above) pass, and Accessibility +
Best Practices are genuinely green in Lighthouse CI (now actually wired
and running, not just configured). Two known, documented gaps remain, both
rooted in the same cause and neither silently dropped:

1. **Performance budget** (QA 10.1/10.2): landing JS is ~230 KB gzip
   against a 130 KB target, and Lighthouse Performance scores 0.83–0.86
   against a 0.90 target on all 4 measured routes. Root cause identified
   (React/Next runtime + full Framer Motion bundle); fix identified
   (LazyMotion migration) but deliberately not attempted in this pass —
   see the Bundle budget section above for why.
2. **Capacitor dry run** (QA 10.7): seven session/param-dependent routes
   cannot build under `output: "export"` — see `docs/TECH_SPEC.md` §12.6.
   Expected given the app's architecture, out of this phase's "ship the
   web app" scope per the Phase 10 planning decision.

The new `lighthouse` CI job is wired as a real, currently-failing gate on
Performance — not loosened to hide it. A human reviewer should decide
whether to merge with that gate red (tracking the LazyMotion follow-up
separately) or block the release tag on it first.

Reviewed by: Claude (Phase 10 implementation), pending final human
review before the release tag.
Date: 2026-07-26
