import { NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/session";
import { exportData } from "@/lib/services/users";

/*
 * Data export (golden rule #7): full JSON of the session user's rows.
 * Not usable under static export (reads the live session cookie) — see
 * TECH_SPEC §12.6. Deliberately not marked `force-static`: that export is
 * shared with the real web build and freezes the route at build time,
 * breaking it in production (confirmed empirically in Phase 10 against
 * app/auth/verify/route.ts before this route was spared the same mistake).
 */
export async function GET() {
  const userId = await readSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "No session — nothing to export yet." },
      { status: 401 },
    );
  }
  const data = await exportData(userId);
  if (!data) {
    return NextResponse.json(
      { error: "No data found for this session." },
      { status: 404 },
    );
  }
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="wanderlost-export.json"',
    },
  });
}
