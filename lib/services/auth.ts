import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { mergeGuestIntoAccount } from "./users";

/*
 * Lean magic-link auth (TECH_SPEC §6): request → signed one-time token
 * emailed via Resend → verify signs in and merges guest data.
 * Rate limit: max 3 requests per email per hour. No passwords, ever.
 */

const TOKEN_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_PER_HOUR = 3;

export class RateLimitError extends Error {
  constructor() {
    super("Too many magic-link requests — try again in an hour");
    this.name = "RateLimitError";
  }
}

export class InvalidTokenError extends Error {
  constructor() {
    super("That sign-in link is invalid or expired");
    this.name = "InvalidTokenError";
  }
}

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export interface MagicLinkRequestResult {
  /** Full sign-in URL — emailed in production, logged in dev. */
  url: string;
  emailSent: boolean;
}

export async function requestMagicLink(
  email: string,
  baseUrl: string,
): Promise<MagicLinkRequestResult> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();

  // Rate limit: count tokens created in the last hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.magicLinkTokens.id })
    .from(schema.magicLinkTokens)
    .where(
      and(
        eq(schema.magicLinkTokens.email, normalized),
        gt(schema.magicLinkTokens.createdAt, oneHourAgo),
      ),
    );
  if (recent.length >= RATE_LIMIT_PER_HOUR) throw new RateLimitError();

  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.magicLinkTokens).values({
    email: normalized,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  const url = `${baseUrl}/auth/verify?token=${token}`;
  const emailSent = await sendMagicLinkEmail(normalized, url);
  return { url, emailSent };
}

async function sendMagicLinkEmail(
  email: string,
  url: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[wanderlost] magic link for ${email}: ${url}`);
    return false;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Wanderlost <onboarding@resend.dev>",
      to: email,
      subject: "Your Wanderlost sign-in link ✈ (simulation)",
      text: `Tap to sign in to Wanderlost: ${url}\n\nThis link expires in 15 minutes.\n\nWanderlost is a travel simulation — no real bookings, no payments, ever.`,
    });
    return true;
  } catch (error) {
    console.error("magic-link email failed", error);
    return false;
  }
}

/**
 * Consume a magic-link token: returns the signed-in account user id.
 * Merges the current guest's data into the account when provided.
 */
export async function verifyMagicLink(
  token: string,
  currentGuestId: string | null,
): Promise<string> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.magicLinkTokens)
    .where(
      and(
        eq(schema.magicLinkTokens.tokenHash, hashToken(token)),
        isNull(schema.magicLinkTokens.consumedAt),
        gt(schema.magicLinkTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const record = rows[0];
  if (!record) throw new InvalidTokenError();

  await db
    .update(schema.magicLinkTokens)
    .set({ consumedAt: new Date() })
    .where(eq(schema.magicLinkTokens.id, record.id));

  // Find or create the account user for this email.
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, record.email))
    .limit(1);
  let accountId: string;
  if (existing[0]) {
    accountId = existing[0].id;
  } else {
    const inserted = await db
      .insert(schema.users)
      .values({ email: record.email, isGuest: false })
      .returning();
    accountId = inserted[0].id;
  }

  if (currentGuestId && currentGuestId !== accountId) {
    const guestRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, currentGuestId))
      .limit(1);
    // Only merge actual guest rows — never absorb another account.
    if (guestRows[0]?.isGuest) {
      await mergeGuestIntoAccount(currentGuestId, accountId);
    }
  }

  return accountId;
}
