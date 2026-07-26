import { NextRequest, NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/session";
import { assertCanView } from "@/lib/services/access";
import { getActiveShareByToken } from "@/lib/services/shares";
import { getCalendarTripData } from "@/lib/services/calendar";
import { buildTripCalendar } from "@/lib/calendar/build";
import { OwnershipError } from "@/lib/services/ownership";

/**
 * .ics calendar export (TECH_SPEC §8b.3, golden rule #9). Auth accepts
 * EITHER a session with view access (assertCanView — owner or
 * collaborator) OR a `?token=` query param resolving to an active share
 * scoped to this exact tripId — the "Add to calendar" button lives on the
 * public /s/[token] page too (WF §20d), where an anonymous visitor has no
 * session at all. Every failure mode collapses to the same generic 404.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const token = request.nextUrl.searchParams.get("token");
  const includeItineraryDays = request.nextUrl.searchParams.get("days") === "1";

  const authorized = await isAuthorized(tripId, token);
  if (!authorized) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const trip = await getCalendarTripData(tripId);
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ics = buildTripCalendar(trip, { includeItineraryDays });
  const filename = trip.destinationCity
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="wanderlost-${filename || "trip"}.ics"`,
    },
  });
}

async function isAuthorized(tripId: string, token: string | null): Promise<boolean> {
  const userId = await readSessionUserId();
  if (userId) {
    try {
      await assertCanView(userId, tripId);
      return true;
    } catch (error) {
      if (!(error instanceof OwnershipError)) throw error;
      // Fall through to the token check — a signed-in visitor with no
      // access of their own can still use a share link's token.
    }
  }
  if (token) {
    const active = await getActiveShareByToken(token);
    if (active && active.trip.id === tripId) return true;
  }
  return false;
}
