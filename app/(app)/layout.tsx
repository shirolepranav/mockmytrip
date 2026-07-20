import { BottomTabBar, TopNav } from "@/components/nav";
import { SimulationBadge } from "@/components/simulation-badge";

/*
 * App shell for every in-app route: persistent SIMULATION badge (golden rule),
 * bottom tab bar on mobile, top nav on ≥lg, safe-area-aware padding.
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
        className="mx-auto w-full max-w-5xl flex-1 px-s4 pt-s5 pb-[calc(var(--nav-height)+var(--safe-bottom)+var(--space-6))] lg:pb-s7"
      >
        {children}
      </main>
      <SimulationBadge />
      <BottomTabBar />
    </div>
  );
}
