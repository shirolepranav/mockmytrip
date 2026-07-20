import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { colors } from "./colors";

/*
 * Token snapshot test (@phase0): globals.css and lib/design/colors.ts must
 * stay in sync — the PDF/email renderers rely on the mirror being accurate.
 */

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

function cssVar(name: string): string | undefined {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  return match?.[1]?.toLowerCase();
}

describe("design tokens (@phase0)", () => {
  it("colors.ts mirrors globals.css exactly", () => {
    expect(cssVar("--ink")).toBe(colors.ink);
    expect(cssVar("--paper")).toBe(colors.paper);
    expect(cssVar("--paper-2")).toBe(colors.paper2);
    expect(cssVar("--sunset")).toBe(colors.sunset);
    expect(cssVar("--sunset-deep")).toBe(colors.sunsetDeep);
    expect(cssVar("--horizon")).toBe(colors.horizon);
    expect(cssVar("--stamp-red")).toBe(colors.stampRed);
    expect(cssVar("--gold")).toBe(colors.gold);
    expect(cssVar("--mint-ok")).toBe(colors.mintOk);
    expect(cssVar("--alert")).toBe(colors.alert);
    expect(cssVar("--line")).toBe(colors.line);
  });

  it("core spacing/radius/easing tokens exist", () => {
    for (const token of [
      "--space-1:",
      "--space-9:",
      "--r-sharp:",
      "--r-card:",
      "--r-pill:",
      "--ease-standard:",
      "--ease-out-expo:",
      "--e-1:",
      "--e-3:",
    ]) {
      expect(css).toContain(token);
    }
  });

  it("night-flight theme overrides exist", () => {
    expect(css).toContain('[data-theme="night"]');
  });
});
