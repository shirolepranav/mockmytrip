import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs module without type declarations
import { checkContent, runCheck } from "./check-no-dark-patterns.mjs";

describe("check-no-dark-patterns (@phase10 @ethics)", () => {
  it("flags 'only N seats left'", () => {
    const violations = checkContent(
      `<p>Only 2 seats left on this flight!</p>`,
      "components/bad.tsx",
    );
    expect(violations.some((v: { rule: string }) => v.rule === "false-scarcity")).toBe(true);
  });

  it("flags 'hurry'", () => {
    const violations = checkContent(
      `const copy = "Hurry, book before it's gone";`,
      "components/bad.tsx",
    );
    expect(violations.some((v: { rule: string }) => v.rule === "false-scarcity")).toBe(true);
  });

  it("flags 'expires soon'", () => {
    const violations = checkContent(
      `<p>This price expires soon</p>`,
      "components/bad.tsx",
    );
    expect(violations.some((v: { rule: string }) => v.rule === "false-scarcity")).toBe(true);
  });

  it("flags 'limited time'", () => {
    const violations = checkContent(
      `<p>Limited time offer</p>`,
      "components/bad.tsx",
    );
    expect(violations.some((v: { rule: string }) => v.rule === "false-scarcity")).toBe(true);
  });

  it("allows plain trip copy with no urgency", () => {
    const violations = checkContent(
      `<p>Your pretend flight to Lisbon, whenever you're ready.</p>`,
      "components/flight-card.tsx",
    );
    expect(violations).toEqual([]);
  });

  it("passes the actual codebase (the gate is green)", () => {
    expect(runCheck()).toEqual([]);
  });
});
