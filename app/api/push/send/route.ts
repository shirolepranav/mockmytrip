import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { listMilestoneCandidates, sendMilestonePush } from "@/lib/services/push";

/*
 * Milestone push cron entry point (Phase 8 task 4, vercel.json's hourly
 * schedule). Vercel Cron sends an `Authorization: Bearer <CRON_SECRET>`
 * header automatically once CRON_SECRET is set on the project — this
 * compares it in constant time, the same pattern lib/auth/session.ts
 * already uses for the session cookie signature.
 */

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const candidates = await listMilestoneCandidates();
  for (const candidate of candidates) {
    await sendMilestonePush(candidate);
  }
  return NextResponse.json({ sent: candidates.length });
}
