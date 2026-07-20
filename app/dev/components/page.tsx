import {
  IconCalendar,
  IconDownload,
  IconGear,
  IconPassport,
  IconPlane,
  IconSearch,
  IconSuitcase,
  IconSwap,
} from "@/components/icons";

/*
 * Design-token gallery (Phase 0 task 9). Renders every token so QA 0.1 can
 * assert fonts, colors, spacing, radii, and elevations visually + computed.
 * Dev-only surface — not linked from the app.
 */

const colorTokens = [
  "--ink",
  "--paper",
  "--paper-2",
  "--ink-soft",
  "--sunset",
  "--sunset-deep",
  "--horizon",
  "--horizon-deep",
  "--sky",
  "--stamp-red",
  "--stamp-violet",
  "--gold",
  "--mint-ok",
  "--alert",
  "--line",
] as const;

const spaceTokens = [
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-5",
  "--space-6",
  "--space-7",
  "--space-8",
  "--space-9",
] as const;

const typeScale = [
  { token: "--text-xs", label: "xs · 12" },
  { token: "--text-sm", label: "sm · 14" },
  { token: "--text-base", label: "base · 16" },
  { token: "--text-lg", label: "lg · 20" },
  { token: "--text-xl", label: "xl · 25" },
  { token: "--text-2xl", label: "2xl · ~34" },
  { token: "--text-3xl", label: "3xl · ~48" },
  { token: "--text-4xl", label: "4xl · ~64" },
  { token: "--text-5xl", label: "5xl · ~88" },
] as const;

export default function ComponentsGalleryPage() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-5xl flex-col gap-s7 px-s5 py-s6"
    >
      <h1 className="font-display text-3xl" data-testid="gallery-title">
        Wanderlost tokens
      </h1>

      <section aria-labelledby="colors-h">
        <h2 id="colors-h" className="font-display text-xl">
          Colors
        </h2>
        <ul className="mt-s4 grid grid-cols-3 gap-s3 sm:grid-cols-5">
          {colorTokens.map((token) => (
            <li key={token} className="flex flex-col gap-s1">
              <span
                data-testid={`swatch${token.replace("--", "-")}`}
                className="h-14 rounded-card border border-line"
                style={{ background: `var(${token})` }}
              />
              <code className="font-mono text-xs text-ink-soft">{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type-h">
        <h2 id="type-h" className="font-display text-xl">
          Type scale &amp; families
        </h2>
        <div className="mt-s4 flex flex-col gap-s3">
          {typeScale.map(({ token, label }) => (
            <p
              key={token}
              className="font-display"
              style={{ fontSize: `var(${token})`, lineHeight: 1.1 }}
            >
              {label} — Wanderlost
            </p>
          ))}
          <p data-testid="font-display-sample" className="font-display text-xl">
            Clash Display — headlines
          </p>
          <p
            data-testid="font-serif-sample"
            className="font-serif text-xl italic"
          >
            Fraunces — tickets, prices &amp; dates
          </p>
          <p data-testid="font-body-sample" className="font-body text-lg">
            Hanken Grotesk — warm, readable body copy.
          </p>
          <p data-testid="font-mono-sample" className="font-mono text-lg">
            MARTIAN MONO — WL-1972 · GATE B12
          </p>
        </div>
      </section>

      <section aria-labelledby="space-h">
        <h2 id="space-h" className="font-display text-xl">
          Spacing (4px base)
        </h2>
        <ul className="mt-s4 flex flex-wrap items-end gap-s3">
          {spaceTokens.map((token) => (
            <li key={token} className="flex flex-col items-center gap-s1">
              <span
                className="block w-6 rounded-sharp bg-horizon"
                style={{ height: `var(${token})` }}
              />
              <code className="font-mono text-xs text-ink-soft">
                {token.replace("--space-", "")}
              </code>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="elev-h">
        <h2 id="elev-h" className="font-display text-xl">
          Elevation (flat offset) &amp; radii
        </h2>
        <div className="mt-s4 flex flex-wrap gap-s5">
          <div className="ticket-surface p-s5 shadow-e1">e-1 · card 14px</div>
          <div className="ticket-surface rounded-sharp p-s5 shadow-e2">
            e-2 · sharp 2px
          </div>
          <div className="ticket-surface rounded-biglg p-s5 shadow-e3">
            e-3 · lg 24px
          </div>
          <div className="ticket-surface rounded-pill px-s5 py-s3 shadow-e1">
            pill
          </div>
        </div>
      </section>

      <section aria-labelledby="btn-h">
        <h2 id="btn-h" className="font-display text-xl">
          Buttons
        </h2>
        <div className="mt-s4 flex flex-wrap items-center gap-s4">
          <button
            type="button"
            className="press-physical min-h-12 rounded-pill bg-sunset px-s6 font-semibold text-ink shadow-e2 hover:bg-sunset-deep hover:text-paper2"
          >
            Primary — sunset pill
          </button>
          <button
            type="button"
            className="press-physical min-h-12 rounded-pill border-2 border-ink px-s6 font-semibold text-ink hover:bg-paper2"
          >
            Secondary — outline
          </button>
          <button
            type="button"
            className="min-h-12 rounded-pill px-s5 font-semibold text-horizon-deep hover:bg-paper2"
          >
            Ghost
          </button>
          <button
            type="button"
            disabled
            className="min-h-12 rounded-pill bg-line px-s6 font-semibold text-ink-soft opacity-60"
          >
            Disabled
          </button>
        </div>
      </section>

      <section aria-labelledby="icons-h">
        <h2 id="icons-h" className="font-display text-xl">
          Icons (2px stroke, 24 grid)
        </h2>
        <div className="mt-s4 flex flex-wrap gap-s4 text-ink">
          <IconPlane />
          <IconSuitcase />
          <IconPassport />
          <IconGear />
          <IconSearch />
          <IconSwap />
          <IconCalendar />
          <IconDownload />
        </div>
      </section>

      <section aria-labelledby="ticket-h">
        <h2 id="ticket-h" className="font-display text-xl">
          Ticket die-cut + perforation
        </h2>
        <div className="ticket-surface die-cut mt-s4 max-w-sm [--die-cut-y:62%]">
          <div className="p-s5">
            <p className="font-mono text-sm tracking-widest uppercase">
              WL-1972 · JFK → LIS
            </p>
            <p className="mt-s2 font-serif text-xl italic">
              Seat 14A · Gate B12
            </p>
          </div>
          <hr className="perforation" />
          <div className="p-s5 font-mono text-xs text-ink-soft">
            SIMULATION — NOT A REAL TICKET
          </div>
        </div>
      </section>
    </main>
  );
}
