import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs module without type declarations
import { checkContent, runCheck } from "./check-banned-styles.mjs";

describe("check-banned-styles (@phase0)", () => {
  it("flags Inter as a font-family", () => {
    const violations = checkContent(
      `body { font-family: Inter, sans-serif; }`,
      "app/bad.css",
    );
    expect(violations.some((v: { rule: string }) => v.rule === "banned-display-font")).toBe(true);
  });

  it("flags purple→indigo Tailwind gradients", () => {
    const violations = checkContent(
      `<div className="bg-gradient-to-r from-purple-500 to-indigo-500" />`,
      "components/bad.tsx",
    );
    expect(violations.some((v: { rule: string }) => v.rule === "banned-gradient")).toBe(true);
  });

  it("flags raw hex outside the token allowlist", () => {
    const violations = checkContent(
      `const color = "#ff0000";`,
      "components/bad.tsx",
    );
    expect(
      violations.some((v: { rule: string }) => v.rule === "raw-hex-outside-tokens"),
    ).toBe(true);
  });

  it("allows raw hex inside the token files", () => {
    expect(checkContent(`--ink: #122a3a;`, "app/globals.css")).toEqual([]);
    expect(
      checkContent(`export const ink = "#122a3a";`, "lib/design/colors.ts"),
    ).toEqual([]);
  });

  it("passes the actual codebase (the gate is green)", () => {
    expect(runCheck()).toEqual([]);
  });
});
