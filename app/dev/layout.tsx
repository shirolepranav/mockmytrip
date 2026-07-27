import { notFound } from "next/navigation";

/*
 * /dev/* is the internal design-token gallery (Phase 0 task 9) — useful in
 * development, never meant to ship. This guard applies to every current and
 * future route under /dev/* in one place, and works identically under the
 * Capacitor static-export build (no dependency on headers()/redirects(),
 * which also don't run under output:"export" — see next.config.ts).
 */
export default function DevLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return children;
}
