import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/*
 * Guest-first sessions (TECH_SPEC §6). The cookie holds `userId.signature`
 * (HMAC-SHA256) — httpOnly, secure, sameSite=lax. No middleware: the cookie
 * is read inside Server Actions / Route Handlers / Server Components, which
 * keeps the app Capacitor-static-export-safe.
 */

export const SESSION_COOKIE = "wl_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 400; // ~13 months

function secret(): string {
  return process.env.AUTH_SECRET ?? "wanderlost-dev-secret-change-me";
}

export function signSessionValue(userId: string): string {
  const signature = createHmac("sha256", secret())
    .update(userId)
    .digest("base64url");
  return `${userId}.${signature}`;
}

export function verifySessionValue(value: string): string | null {
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  const userId = value.slice(0, dotIndex);
  const signature = value.slice(dotIndex + 1);
  const expected = createHmac("sha256", secret())
    .update(userId)
    .digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

/** Session user id from the request cookie, or null. */
export async function readSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  return raw ? verifySessionValue(raw) : null;
}

/** Set the session cookie (Server Action / Route Handler contexts only). */
export async function establishSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSessionValue(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

/** Clear the session cookie (used by delete-all-data). */
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
