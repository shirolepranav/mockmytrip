// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostcardShareButton } from "./postcard-share-button";

/*
 * @phase8 PostcardShareButton (QA 8.9): Web Share when available (an
 * explicit opt-in tap, never automatic — no share sheet on load), copy-link
 * fallback otherwise. The shared text always bakes in "SIMULATION".
 *
 * navigator.share/clipboard are (re)defined AFTER userEvent.setup() —
 * @testing-library/user-event installs its own navigator.clipboard stub
 * during setup(), which would otherwise clobber a mock defined earlier.
 */

describe("@phase8 PostcardShareButton", () => {
  it("uses Web Share when available, with SIMULATION in the text", async () => {
    const user = userEvent.setup();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: shareMock, configurable: true });

    render(<PostcardShareButton destinationCity="Lisbon" />);
    await user.click(screen.getByTestId("postcard-share-button"));

    expect(shareMock).toHaveBeenCalledTimes(1);
    const call = shareMock.mock.calls[0][0];
    expect(call.text).toMatch(/simulation/i);
    expect(call.text).toContain("Lisbon");

    // @ts-expect-error -- test-only cleanup
    delete navigator.share;
  });

  it("falls back to copy-link and shows a confirmation toast when Web Share is unavailable", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    render(<PostcardShareButton destinationCity="Lisbon" />);
    await user.click(screen.getByTestId("postcard-share-button"));

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock.mock.calls[0][0]).toMatch(/simulation/i);
    expect(await screen.findByTestId("toast")).toHaveTextContent(/copied/i);

    // @ts-expect-error -- test-only cleanup
    delete navigator.share;
  });
});
