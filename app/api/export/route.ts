import { NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/session";
import { exportData } from "@/lib/services/users";

/** Data export (golden rule #7): full JSON of the session user's rows. */
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
