import { IconPassport } from "@/components/icons";

/* Decorative passport-page header (WF §16). Pure UI chrome, not synthetic
 * travel data, so it stays out of lib/engine/*. */
export function PassportCover({ stampCount }: { stampCount: number }) {
  return (
    <header className="ticket-surface flex flex-col items-center gap-s2 rounded-card border-2 border-gold p-s6 text-center">
      <IconPassport size={40} className="text-gold" />
      <p className="font-display text-2xl tracking-wide">
        Wanderlost Passport
      </p>
      <p className="font-mono text-xs tracking-widest text-ink-soft uppercase">
        {stampCount === 0
          ? "Your first stamp awaits"
          : `${stampCount} stamp${stampCount === 1 ? "" : "s"} collected`}
      </p>
    </header>
  );
}
