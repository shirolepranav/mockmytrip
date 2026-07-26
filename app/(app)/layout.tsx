import { BottomTabBar, TopNav } from "@/components/nav";
import { SimulationBadge } from "@/components/simulation-badge";
import { GlobalOfflineBanner } from "@/components/global-offline-banner";

/*
 * App shell for every in-app route: persistent SIMULATION badge (golden rule),
 * bottom tab bar on mobile, top nav on ≥lg, safe-area-aware padding.
 * The offline banner (Phase 8 task 2, WF §21) lives here so it covers every
 * in-app route, not just the itinerary/packing pages that already handled
 * it locally since Phase 7.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <main
        id="main"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-s4 px-s4 pt-s5 pb-[calc(var(--nav-height)+var(--safe-bottom)+var(--space-6))] lg:pb-s7"
      >
        <GlobalOfflineBanner />
        {children}
      </main>
      <SimulationBadge />
      <BottomTabBar />
    </div>
  );
}
