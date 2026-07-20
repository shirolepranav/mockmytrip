---
name: design-system
description: Use when building or restyling any UI component, page, color, typography, spacing, or layout in Wanderlost. Enforces the retro-travel visual identity and the anti-vibe-code rules. Triggers on "component", "style", "UI", "page", "Tailwind", "design".
---

Build components in Wanderlost's distinctive retro-travel identity. Never produce generic AI-slop UI. Full spec: `docs/DESIGN_SYSTEM.md`.

## Always
- Use design tokens (CSS variables) for every color/space/radius/shadow/motion value. Never hardcode.
- Mobile-first. Test 390px and iPad (768/1024). Touch targets >=44px. Respect safe-area insets.
- Every animation needs a reduced-motion variant (see playful-animations skill).
- AA contrast; focus-visible in --horizon; never color-only signaling.

## Identity
- Palette: ink #122A3A, paper #F6EEDF, sunset #F4713B, horizon #177E7E, stamp-red #C4362E, gold #E8B23A.
- Fonts: display = Clash Display (fallback Bricolage Grotesque); serif accent = Fraunces (prices/dates);
  body = Hanken Grotesk; mono = Martian Mono (boards/flight numbers/countdown).
- Depth = FLAT OFFSET shadows (e.g. 5px 6px 0 rgba(18,42,58,.16)) + 1px --line borders + ticket die-cut
  notches + ~4% paper-grain texture. NOT blurry drop shadows, NOT glassmorphism-by-default.
- Mixed radii: sharp 2px tickets/boards, 14px cards, 999px pills for buttons/chips.

## NEVER (anti-vibe-code)
- No Inter/Roboto/Arial/system-ui/Space Grotesk display. No purple->blue gradient. No uniform 16px radius.
- No emoji as UI icons. No default shadcn look. No stock/AI hero photos. No three-identical-cards hero.

## Components
Restyle any Radix/shadcn primitive fully with tokens. Reuse the inventory in docs/DESIGN_SYSTEM.md §9:
Button, Autocomplete, BoardingPass, FlightResultCard, HotelCard, DepartureBoard, CountdownFlip, Stepper,
Toast, Passport/Stamp, PoiCard (real places get a "Real place" chip; simulated prices keep the SIMULATION label).
