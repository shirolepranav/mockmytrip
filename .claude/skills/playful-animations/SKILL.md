---
name: playful-animations
description: Use when implementing any animation, transition, micro-interaction, loading state, or celebratory moment in Wanderlost. Covers Motion, GSAP, canvas-confetti, Rive, and mandatory reduced-motion. Triggers on "animation", "transition", "confetti", "loading", "countdown", "stamp", "reveal", "micro-interaction".
---

Implement delightful, physical motion. High-impact set-pieces over scattered fidgets. Full spec: `docs/DESIGN_SYSTEM.md` §7–§8.

## Library choice
- Motion (`motion`, ex-Framer Motion): UI enter/exit, layout/shared-layout (layoutId), gestures
  (drag, swipe-to-dismiss), route transitions (app/template.tsx). Default choice.
- GSAP + useGSAP (@gsap/react): timeline set-pieces — departure-board split-flap loader,
  boarding-pass reveal, stamp thump. Dynamic-import so it stays out of initial JS.
- canvas-confetti: celebration bursts (cap ~150 particles on mobile). Dynamic-import.
- Rive: optional interactive passport mascot / empty-state character. Never a hard dependency.
- Don't have two libraries animate the same property on the same element.

## Tokens (use these; don't invent)
- Durations: micro 120-180ms, UI 220-320ms, set-pieces 600-1200ms.
- Easings: standard cubic-bezier(0.2,0.7,0.2,1); out-expo cubic-bezier(0.16,1,0.3,1);
  out-back cubic-bezier(0.34,1.56,0.64,1).
- Springs (Motion): soft {stiffness:260,damping:24}; bouncy {stiffness:420,damping:14};
  heavy {stiffness:180,damping:30}. List stagger 40-60ms.

## Signature set-pieces (per DESIGN_SYSTEM §8)
- DepartureBoard loader: GSAP split-flap flicker settling into airline/time/price rows.
- Boarding-pass reveal: pass slides up, perforation tears, stamp thumps (overshoot),
  capped confetti burst, gold shimmer.
- Passport stamp: wind-up rotate+scale, thump with ink-spread mask + dust puff, settle at rotation_deg.
- CountdownFlip: flip digits; only seconds animate continuously; aria-live on day change only.
- Buttons: press scale 0.96 + shadow collapse (physical), release springs back.

## MANDATORY reduced-motion
Read prefers-reduced-motion AND the Settings toggle via the lib/motion MotionProvider. When reduced:
opacity-only or instant transitions; NO transforms/parallax; NO confetti (static celebratory graphic +
text); countdown updates without flip. Add the reduced variant in the SAME change as the animation.
Animate only transform/opacity (GPU); never layout properties.
