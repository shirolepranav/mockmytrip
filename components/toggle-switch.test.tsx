// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionProvider } from "@/lib/motion/reduced-motion";
import { ToggleSwitch } from "./toggle-switch";

/*
 * @phase8 ToggleSwitch: correct a11y role/aria-checked, and both click and
 * keyboard activation toggle it (Settings appearance/notifications rely
 * on this shared primitive).
 */

describe("@phase8 ToggleSwitch", () => {
  it("exposes role=switch and the correct aria-checked state", () => {
    render(
      <MotionProvider>
        <ToggleSwitch checked={false} onChange={() => {}} label="Test toggle" />
      </MotionProvider>,
    );
    const toggle = screen.getByRole("switch", { name: "Test toggle" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the flipped value on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MotionProvider>
        <ToggleSwitch checked={false} onChange={onChange} label="Test toggle" />
      </MotionProvider>,
    );
    await user.click(screen.getByRole("switch", { name: "Test toggle" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("is keyboard-activatable (Enter/Space on a focused button)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MotionProvider>
        <ToggleSwitch checked={true} onChange={onChange} label="Test toggle" />
      </MotionProvider>,
    );
    const toggle = screen.getByRole("switch", { name: "Test toggle" });
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not fire onChange when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MotionProvider>
        <ToggleSwitch checked={false} onChange={onChange} label="Test toggle" disabled />
      </MotionProvider>,
    );
    await user.click(screen.getByRole("switch", { name: "Test toggle" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
