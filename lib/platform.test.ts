import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isNativePlatform } from "./platform";

/*
 * @phase8 native-platform guard (QA 8.12): the build-time env flag and a
 * runtime Capacitor global are both honored, and a plain web browser (no
 * Capacitor, no flag) is never mistaken for native.
 */

describe("@phase8 isNativePlatform", () => {
  const originalEnv = process.env.NEXT_PUBLIC_IS_NATIVE;

  beforeEach(() => {
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_IS_NATIVE = originalEnv;
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it("is false in a plain web browser", () => {
    process.env.NEXT_PUBLIC_IS_NATIVE = "false";
    expect(isNativePlatform()).toBe(false);
  });

  it("is true when the build-time native flag is set", () => {
    process.env.NEXT_PUBLIC_IS_NATIVE = "true";
    expect(isNativePlatform()).toBe(true);
  });

  it("defers to window.Capacitor.isNativePlatform() when present, over the env flag", () => {
    process.env.NEXT_PUBLIC_IS_NATIVE = "false";
    (window as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor = {
      isNativePlatform: () => true,
    };
    expect(isNativePlatform()).toBe(true);
  });

  it("respects window.Capacitor reporting false even if the env flag says true", () => {
    process.env.NEXT_PUBLIC_IS_NATIVE = "true";
    (window as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor = {
      isNativePlatform: () => false,
    };
    expect(isNativePlatform()).toBe(false);
  });
});
