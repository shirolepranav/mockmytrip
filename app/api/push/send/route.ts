import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  listCollaboratorDigestCandidates,
  listMilestoneCandidates,
  sendCollaboratorDigest,
  sendMilestonePush,
} from "@/lib/services/push";

/*
 * Push cron entry point (Phase 8 task 4, vercel.json's hourly schedule).
 * Vercel Cron sends an `Authorization: Bearer <CRON_SECRET>` header
 * automatically once CRON_SECRET is set on the project — this compares it
 * in constant time, the same pattern lib/auth/session.ts already uses for
 * the session cookie signature.
 *
 * Not usable under static export (reads a live request header) — see
 * TECH_SPEC §12.6. Deliberately not marked `force-static`: that export is
 * shared with the real web build and would freeze the route at build
 * time, breaking it in production. Moot for native anyway: there is no
 * Vercel Cron inside a Capacitor build.
 */

/*
 * Phase 9 adds the owner "new ideas from collaborators" digest as a second
 * pass over the same cron tick — no new route or vercel.json entry needed.
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

  const digestCandidates = await listCollaboratorDigestCandidates();
  for (const candidate of digestCandidates) {
    await sendCollaboratorDigest(candidate);
  }

  return NextResponse.json({
    sent: candidates.length,
    digestsSent: digestCandidates.length,
  });
}
