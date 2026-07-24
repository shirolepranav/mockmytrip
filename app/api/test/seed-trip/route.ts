import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { establishSession, readSessionUserId } from "@/lib/auth/session";
import { getOrCreateGuest } from "@/lib/services/users";
import { seedTestTrip } from "@/lib/services/test-seed";

/*
 * Dev/test-only trip seeding endpoint (Phase 6). The real search->checkout
 * flow can't produce past/in-progress trips for e2e coverage (the date
 * picker floors at today, and Playwright's page.clock only mocks the
 * browser tab, not this server's Node process). Double-gated: disabled in
 * production, and requires a shared secret that's only ever set in test
 * config — never reachable on the real deployed app.
 */

const seedTripSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  originIata: z.string().length(3).optional(),
  destIata: z.string().length(3).optional(),
  departAt: z.string(),
  arriveAt: z.string(),
  endDate: z.string(),
  distanceKm: z.number().positive().optional(),
  savedCents: z.number().int().nonnegative().optional(),
  withStamp: z.boolean().optional(),
});

function secretMatches(request: NextRequest): boolean {
  const expected = process.env.TEST_SEED_SECRET;
  if (!expected) return false; // no secret configured = endpoint stays closed
  const provided = request.headers.get("x-test-seed-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || !secretMatches(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = seedTripSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await readSessionUserId();
  const user = await getOrCreateGuest(existing);
  await establishSession(user.id);

  const result = await seedTestTrip(user.id, {
    title: parsed.data.title,
    originIata: parsed.data.originIata,
    destIata: parsed.data.destIata,
    departAt: new Date(parsed.data.departAt),
    arriveAt: new Date(parsed.data.arriveAt),
    endDate: new Date(parsed.data.endDate),
    distanceKm: parsed.data.distanceKm,
    savedCents: parsed.data.savedCents,
    withStamp: parsed.data.withStamp,
  });

  return NextResponse.json(result);
}
