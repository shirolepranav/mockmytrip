// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { signSessionValue, verifySessionValue } from "./session";

/*
 * @phase10: AUTH_SECRET must never silently fall back to the insecure dev
 * default in production (Phase 10 launch-readiness gap). signSessionValue/
 * verifySessionValue are the only exported functions that touch secret()
 * without also requiring a next/headers request context, so they're the
 * cheapest way to exercise it directly.
 */
describe("session secret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when AUTH_SECRET is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => signSessionValue("user_123")).toThrow(/AUTH_SECRET/);
  });

  it("falls back to the dev secret outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => signSessionValue("user_123")).not.toThrow();
  });

  it("signs and verifies round-trip when AUTH_SECRET is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "a-real-production-secret");
    const signed = signSessionValue("user_123");
    expect(verifySessionValue(signed)).toBe("user_123");
  });
});
