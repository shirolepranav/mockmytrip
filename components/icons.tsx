import type { SVGProps } from "react";

/*
 * Custom 2px-stroke line icon set (docs/DESIGN_SYSTEM.md §6).
 * 24px grid, rounded joints, currentColor — never emoji as UI icons.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

/** Paper plane — search / send. */
export function IconPlane(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 4 3.6 10.5c-.8.3-.75 1.44.07 1.7l6.13 1.9 1.9 6.13c.25.82 1.4.87 1.7.07L20 3" />
      <path d="m9.8 14.1 10.6-10.4" />
    </svg>
  );
}

/** Suitcase — trips. */
export function IconSuitcase(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M9 12v4M15 12v4" />
    </svg>
  );
}

/** Passport booklet with stamp mark. */
export function IconPassport(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M9 16.5h6" />
    </svg>
  );
}

/** Gear — settings. */
export function IconGear(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </svg>
  );
}

/** Magnifier — search field affordance. */
export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </svg>
  );
}

/** Close X. */
export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

/** Download arrow into tray. */
export function IconDownload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v10M8 10.5l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

/** Chevron left (back). */
export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </svg>
  );
}

/** Chevron right. */
export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  );
}

/** Chevron down. */
export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
    </svg>
  );
}

/** Plus. */
export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Minus. */
export function IconMinus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14" />
    </svg>
  );
}

/** Info circle. */
export function IconInfo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.5v.5" />
    </svg>
  );
}

/** Swap arrows (origin/destination). */
export function IconSwap(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 8h11M15 4.5 18.5 8 15 11.5" />
      <path d="M17 16H6M9 12.5 5.5 16 9 19.5" />
    </svg>
  );
}

/** Calendar. */
export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" />
    </svg>
  );
}
