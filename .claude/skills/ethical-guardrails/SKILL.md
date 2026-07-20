---
name: ethical-guardrails
description: Use when touching checkout, booking, boarding pass, email, notifications, metrics, onboarding, POI data, or any labeling in Wanderlost. Enforces the hard ethical rules. Triggers on "checkout", "payment", "booking", "notification", "streak", "email", "simulation label", "metrics", "real place".
---

These rules are non-negotiable. If a request conflicts, refuse and explain.

## Hard rules
1. NO payment fields ever — no card/CVV/billing inputs, no payment SDK. Checkout total is always $0.00
   with the synthetic price struck through and a "you saved $X" reframing.
2. Persistent "SIMULATION" label on every screen, the checkout, the on-screen + PDF boarding pass,
   and the confirmation email. Never remove/hide it.
3. NO dark patterns: no punishing streaks, no false scarcity, no countdown-to-book pressure,
   no confirm-shaming, no manipulative FOMO, no auto-opt-in. Notifications are opt-in and frequency-capped.
4. Wellbeing framing: savings, savoring, calm; optional mood check-ins; gentle time nudge if sessions run long.
   Do NOT optimize for time-on-app or DAU streaks.
5. Data minimalism: optional email + user content only. Export (JSON) and hard delete must always work.
   No third-party ad/tracking SDKs.
6. Fictional brands only for airlines/hotels (enforced by the synthetic-data blocklist).
   Email must be clearly marked a simulation.
7. Real POIs (sights/restaurants) are the ONLY real-world data with names: label them "Real place",
   never attach fake prices/ratings/reviews to them, and keep source attribution (OSM ODbL, CC BY-SA).
   Bookings referencing a real POI in an itinerary are still clearly simulated bookings.

## Required tests when editing these areas
- "no payment field" DOM assertion passes (zero card/billing inputs anywhere; no payment SDK scripts).
- "SIMULATION present" assertion on checkout, boarding pass (screen + PDF), and email template.
- Dark-pattern grep passes (no "only X left|hurry|expires soon" strings).
- Notification flows require explicit opt-in.
- POI surfaces show attribution and the "Real place" chip.
