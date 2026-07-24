# WANDERLOST — Product Requirements Document (PRD)

> **Project:** Wanderlost — a "travel dopamine" simulation web app. Everything is fake; everything feels real.
> **Companion docs:** `TECH_SPEC.md`, `DESIGN_SYSTEM.md`, `APP_WORKFLOW.md`, `IMPLEMENTATION_PLAN.md`, `CLAUDE.md` + `.claude/skills/*`.

## 1. Vision
Wanderlost is a mock travel-booking app where nothing is real but everything feels real. Users search real airports and cities, "book" flights and hotels priced by a synthetic engine, pay **$0.00** at a checkout with no payment fields, and receive a confirmation email plus a downloadable boarding pass. They then live inside the *anticipation*: a countdown to a fake trip, an itinerary builder, a virtual passport that collects stamps, packing lists, and "trip memories" after the fake date passes. The product exists to deliver the well-documented dopamine hit of anticipating travel — without the cost, carbon, or logistics.

## 2. Problem Statement (grounded in research)
Happiness research consistently shows the *anticipation* of travel produces more happiness than the trip itself:

- **Nawijn, Marchand, Veenhoven & Vingerhoets (2010), "Vacationers Happier, but Most not Happier After a Holiday"** (*Applied Research in Quality of Life* 5(1):35–47). Pre-test/post-test study of 1,530 Dutch individuals (974 vacationers, 556 non-vacationers). Vacationers reported higher *pre-trip* happiness vs. non-vacationers — attributed to anticipation. Post-trip there was generally no difference unless the holiday was very relaxing, and the effect faded within ~8 weeks.
- **Kumar, Killingsworth & Gilovich (2014), "Waiting for Merlot: Anticipatory Consumption of Experiential and Material Purchases"** (*Psychological Science* 25(10)): four studies demonstrate people derive more happiness from anticipating experiential purchases, and waiting for an experience is more pleasurable and exciting than waiting for a material good.
- **Schultz's dopamine reward-prediction-error research** (Schultz, Dayan & Montague 1997, *Science* 275:1593–1599; Schultz 2016): midbrain dopamine neurons fire on the *prediction* of reward, not only its receipt — the neural basis for why browsing and the "checkout" moment feel good in themselves.
- The Korean **"dopamine site"** trend (e.g., FoodNeverComes / 음식만안와요, the fake food-delivery app where the food never arrives, ~700k users) validates consumer appetite for reward-without-transaction rituals.

Wanderlost applies this to travel — the highest-anticipation experiential-purchase category — *ethically*: maximizing savoring while stripping out spending, deception, and dark patterns.

## 3. Target Users & Personas
- **"Grounded Dreamer" (primary):** 22–38, budget- or time-constrained, opens flight-search apps for fun but rarely books. Wants the thrill without the bill.
- **"Between-Trips Planner":** already travels; savors and pre-plans future real trips, building itineraries/packing lists they may reuse.
- **"Wind-Down Ritualist":** uses it as a calmer alternative to doomscrolling — a nightly 5-minute mood lift.
- **"Wistful Nostalgic":** revisits "trip memories" and passport stamps for reflective, positive affect.

## 4. Goals
1. Deliver a delightful, distinctive, mobile-first experience that maximizes anticipation and savoring.
2. Be honest at every step (persistent SIMULATION labeling; zero payment collection).
3. Run at near-zero cost on free tiers.
4. Be installable as a PWA and architected so a future Capacitor iOS wrap requires no rewrite.

## 5. Non-Goals
- No real bookings, prices, payments, or brand partnerships — ever.
- No monetization, ads, affiliate links, or upsells (v1–v3).
- No engagement-maximizing dark patterns (punishing streaks, scarcity timers, manipulative FOMO).
- No social network / public feed in MVP (opt-in sharing, later tier only).
- No account required to *start* playing (guest mode first).

## 6. Success Metrics (wellbeing-focused, NOT engagement-maximizing)

### Primary
- **Self-reported mood lift:** optional 1-tap "How do you feel?" before/after a session; target ≥70% report neutral-or-better lift.
- **Anticipation depth:** % of fake trips that gain an itinerary item, packing item, or passport stamp (savoring behaviors); target ≥50%.
- **Cumulative "you saved $X":** total synthetic dollars "saved," surfaced as a positive reframing metric.

### Guardrail / anti-metrics (monitor, do NOT maximize)
- Session length is a guardrail, not a target. If median session exceeds ~12 min, surface a gentle "enjoy the real world" nudge.
- No daily-active-user streak pressure.

### Secondary
- PWA install rate; boarding-pass download rate; healthy return cadence within 30 days (not addiction loops).

## 7. Feature Requirements

### 7.1 MVP (Tier 1)
1. Onboarding + simulation disclosure (unskippable, plain-language).
2. Guest mode (localStorage/cookie session) with optional magic-link account.
3. Flight search: origin/destination autocomplete (real airports), dates, passengers, cabin.
4. Search results: synthetic flights (fictional airlines, realistic times/prices), sortable/filterable; departure-board loading state.
5. Flight detail / selection.
6. Hotel search / results / detail (fictional hotels, realistic locations & prices).
7. Trip summary (flight[s] + hotel).
8. Fake checkout: $0.00, NO payment fields, prominent SIMULATION labeling.
9. Confirmation: on-screen boarding pass + downloadable PDF + confirmation email.
10. My Trips dashboard.
11. Trip detail with countdown timer (flip animation).
12. Virtual passport with animated stamp per booking.
13. "You saved $X" reframing.
14. Settings (reduced motion, notifications, data export/delete, theme).
15. About/Ethics page.
16. PWA install + basic offline shell.

### 7.2 Tier 2
- **Explore destination guide (REAL places):** famous sights, landmarks, and restaurants per destination, seeded from open data (Wikidata, Wikivoyage, OpenStreetMap). POIs are real and labeled "Real place"; bookings/prices remain simulated. Makes the app useful for *actual* trip planning — research (Chen 2021, *Tourism Analysis*) shows people who plan trips more actually travel more and are happier.
- Itinerary builder (day-by-day, drag to reorder; optional AI suggestions via LLM API; add real POIs from Explore directly to itinerary days).
- **Itinerary export** (shareable/printable text or PDF) so a "fake trip" plan doubles as a real-trip head start.
- **Trip sharing & collaboration:** share a trip via a tokenized link; recipients can view read-only or (if granted) **co-edit the itinerary** — adding places to days. Shared trips appear in both users' dashboards. Social savoring is supported by the research (shared experiences produce more happiness than solo ones) and collaborative planning is a genuine unsolved pain for real group trips.
- **Calendar export (.ics):** download an `.ics` file that works with Google Calendar, Apple Calendar, and Outlook — no OAuth, no calendar read access, no Google Cloud project. Events are self-labelling as simulated and default to "Free" availability.
- **Collaborator countdowns/reminders:** collaborators who opt in get the same countdown milestones for a shared trip.
- Packing lists (templated by destination climate + trip length; check-off).
- Web push (opt-in): countdown milestones, "trip day," memory prompts.
- Trip memories (unlock after fake end date: recap, "postcard," savings tally).
- Multi-segment / round-trip flights.

### 7.3 Tier 3
- Rive-based interactive passport mascot; shareable postcards (opt-in, no public feed).
- "Surprise me" random dream-trip generator.
- Seasonal themed stamps/events (non-punishing, no FOMO timers).
- Capacitor iOS wrap.

## 8. User Stories with Acceptance Criteria

**US-1 Simulation clarity.** *As a new user, I understand immediately that nothing is real.*
- AC1: First load shows a plain-language disclosure that all flights/hotels/prices/bookings are simulated and no payment is ever taken.
- AC2: User must tap "I understand — let's dream" to proceed.
- AC3: A persistent "SIMULATION" badge is visible on every screen thereafter.
- AC4: Choice is stored; returning users skip the full screen but still see the badge.

**US-2 Flight search.** *As a user, I can search flights between real places.*
- AC1: Origin & destination autocomplete from real airport data (city, airport name, IATA).
- AC2: Dates (no past departure), passenger count (1–9), and cabin.
- AC3: Submit shows a loading state within 100ms, results within 2s on 4G.
- AC4: origin=destination is blocked inline.

**US-3 Realistic results.** *As a user, results feel like a real travel site.*
- AC1: Each result shows a fictional airline name+mark, plausible flight number, depart/arrive times, duration derived from great-circle distance, stops, synthetic price.
- AC2: Durations are internally consistent (arrival = departure + duration ± timezone).
- AC3: Prices vary by distance, season, and small jitter but are stable for a given search within a session (seeded).

**US-4 Fake checkout, no payment.** *As a user, I "book" without ever entering payment.*
- AC1: Checkout shows **$0.00** with the synthetic price struck through and a "you're saving $X" line.
- AC2: There are **no** card/CVV/billing fields anywhere.
- AC3: A SIMULATION banner is pinned.
- AC4: Confirm triggers a celebratory boarding-pass reveal (confetti + stamp).

**US-5 Boarding pass.** *As a user, I get a boarding pass I can keep.*
- AC1: On confirmation I see an on-screen boarding pass (route, fictional airline, flight number, seat, gate, date, QR/barcode encoding a fake PNR, clearly marked simulated).
- AC2: I can download it as a PDF.
- AC3: I receive a confirmation email (if I provided one) with the same details and a clear simulation disclaimer.

**US-6 Countdown & savoring.** *As a user, I anticipate my trip.*
- AC1: Trip detail shows a live countdown (days/hours/min/sec) with flip animation to the fake departure.
- AC2: I can add itinerary items, packing items, and view my passport stamp.
- AC3: After the fake end date, "Trip Memories" unlocks.

**US-7 Wellbeing, not addiction.** *As a user, the app respects my time.*
- AC1: No streak counters that punish absence.
- AC2: No countdown scarcity pressure to book ("2 seats left!" is banned).
- AC3: Notifications are opt-in and frequency-capped.
- AC4: Settings allow full export and delete of my data.

**US-9 Share a trip.** *As a user, I can share my dream trip with a friend.*
- AC1: From trip detail I can generate a share link (random unguessable token) and choose **View only** or **Can edit**.
- AC2: The shared page shows the itinerary, route, and destination art, with the SIMULATION label unmistakably present so no viewer believes a real booking exists.
- AC3: Viewers need no account to view; an account is only required to co-edit or save the trip.
- AC4: I can revoke the link at any time; revoked links show a friendly "this dream has been tucked away" page.
- AC5: Sharing is never required to unlock features — no referral gating (see §9.3).

**US-10 Collaborate on an itinerary.** *As an invited friend, I can add places to the plan.*
- AC1: With edit permission I can add/edit/reorder itinerary items and add POIs from Explore.
- AC2: Each item shows who added it; changes appear for the owner on next load.
- AC3: The owner can downgrade a collaborator to view-only or remove them.
- AC4: Collaborators cannot delete the trip, change bookings, or see the owner's other trips.

**US-11 Add to calendar.** *As a user, I can put my trip in my calendar.*
- AC1: "Add to calendar" downloads a valid `.ics` importable by Google Calendar, Apple Calendar, and Outlook.
- AC2: The event title self-labels as pretend (e.g. `✈ (Pretend) Tokyo · Wanderlost`) and the description states it is a simulation with no real booking.
- AC3: Events default to **Free** availability (`TRANSP:TRANSPARENT`), never Busy, so colleagues checking availability aren't misled.
- AC4: No Google Calendar OAuth and no calendar read permission is ever requested.

**US-8 Accessibility & motion.** *As a user, I can turn motion down.*
- AC1: If OS `prefers-reduced-motion` is set, all non-essential animation defaults to instant/opacity transitions.
- AC2: A manual reduced-motion toggle in Settings overrides.
- AC3: All interactive targets ≥44×44px; contrast meets WCAG AA.

## 9. Ethical Requirements (hard, non-negotiable)
1. **Persistent, unmissable SIMULATION labeling** on every screen, the checkout, the boarding pass, and the email.
2. **Never collect payment information** — no card fields, no billing address, no payment SDKs.
3. **No dark patterns:** no false scarcity, no countdown-to-book pressure, no punishing streaks, no confirm-shaming, no manipulative FOMO, no auto-opt-in notifications. **No referral gating** — sharing must never be required to unlock a feature, stamp, or reward ("invite 3 friends to unlock…" is banned). Any signups sharing produces are a byproduct, not a growth mechanic.
3b. **Real-world confusion guards for shared/exported artifacts:** shared trip pages carry the SIMULATION label; calendar events self-label as pretend, state the simulation in the description, and default to Free availability so a colleague checking a calendar never assumes real travel.
4. **Wellbeing framing:** savings, savoring, calm; optional mood check-ins; gentle time nudges.
5. **Data minimalism:** collect only optional email + user-created content; easy export & delete; no third-party ad/tracking.
6. **No impersonation** of real airlines/hotels/brands — all bookable names fictional; disclaimers where confusion is possible. **Exception — real POIs:** sights/restaurants in Explore are real places (facts, not bookings), labeled "Real place," never given fake prices/ratings/reviews, with source attribution (OSM ODbL, CC BY-SA).
7. **Honest email:** confirmation email subject/body clearly marked as a simulation.

## 10. Constraints
- Free tiers only (Vercel Hobby; Neon free Postgres; Resend free 3,000/mo & 100/day; optional LLM API with strict caps).
- Mobile-first; must excel on phones and iPad.
- Must remain static-exportable-capable for Capacitor (see `TECH_SPEC.md` §12).

## 11. Risks & Mitigations
- **Perceived bleakness ("dystopian")** → warm, witty, self-aware tone; wellbeing framing; About page explains the science.
- **User confusion / thinks it's real** → aggressive simulation labeling; zero payment fields removes worst-case harm.
- **Email deliverability / spam** → SPF/DKIM via Resend domain; low volume; clear sender.
- **Free-tier limits exceeded** → seeded/cached synthetic data; scale-to-zero DB; email caps; LLM behind quota + graceful fallback.
- **Motion overwhelm / accessibility** → reduced-motion first-class; performance budgets.
- **Scope creep** → strict MVP/Tier gating per `IMPLEMENTATION_PLAN.md`.
