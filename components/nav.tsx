"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconGear,
  IconPassport,
  IconPlane,
  IconSuitcase,
} from "@/components/icons";

/*
 * App navigation: bottom tab bar on mobile (safe-area aware),
 * top nav from lg upward. Tabs per docs/APP_WORKFLOW.md global rules.
 */

const tabs = [
  { href: "/search/flights", label: "Search", icon: IconPlane },
  { href: "/trips", label: "Trips", icon: IconSuitcase },
  { href: "/passport", label: "Passport", icon: IconPassport },
  { href: "/settings", label: "Settings", icon: IconGear },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/search/flights") {
    return (
      pathname.startsWith("/search") ||
      pathname.startsWith("/flight") ||
      pathname.startsWith("/hotel") ||
      pathname.startsWith("/trip/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      data-testid="bottom-tab-bar"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper2 pb-[var(--safe-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-md items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  active ? "text-sunset-deep" : "text-ink-soft"
                }`}
              >
                <Icon size={22} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <header
      data-testid="top-nav"
      className="sticky top-0 z-30 hidden border-b border-line bg-paper/90 backdrop-blur-sm lg:block"
    >
      <div className="mx-auto flex h-[var(--nav-height)] max-w-5xl items-center justify-between px-s5">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight"
        >
          Wanderlost
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-s2">
            {tabs.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-pill px-s4 font-medium ${
                      active
                        ? "bg-ink text-paper2"
                        : "text-ink-soft hover:bg-paper2"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
