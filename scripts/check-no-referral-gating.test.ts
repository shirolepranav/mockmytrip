import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs module without type declarations
import { checkContent, runCheck } from "./check-no-referral-gating.mjs";

describe("check-no-referral-gating (@phase9 @ethics)", () => {
  it("flags 'invite N friends to unlock'", () => {
    const violations = checkContent(
      `<p>Invite 3 friends to unlock premium stamps</p>`,
      "components/bad.tsx",
    );
    expect(violations.some((v: { rule: string }) => v.rule === "referral-gating")).toBe(true);
  });

  it("flags 'refer a friend'", () => {
    const violations = checkContent(
      `const copy = "Refer a friend and get bonus miles";`,
      "components/bad.tsx",
    );
    expect(violations.some((v: { rule: string }) => v.rule === "referral-gating")).toBe(true);
  });

  it("flags 'share ... to unlock'", () => {
    const violations = checkContent(
      `<p>Share this trip to unlock the passport stamp</p>`,
      "components/bad.tsx",
    );
    expect(violations.some((v: { rule: string }) => v.rule === "referral-gating")).toBe(true);
  });

  it("allows plain sharing copy with no gating", () => {
    const violations = checkContent(
      `<p>Share this dream trip with anyone — no strings attached.</p>`,
      "components/share-sheet.tsx",
    );
    expect(violations).toEqual([]);
  });

  it("allows 'Add your ideas' collaboration copy", () => {
    const violations = checkContent(
      `<button>Add your ideas</button>`,
      "app/s/[token]/page.tsx",
    );
    expect(violations).toEqual([]);
  });

  it("passes the actual codebase (the gate is green)", () => {
    expect(runCheck()).toEqual([]);
  });
});
