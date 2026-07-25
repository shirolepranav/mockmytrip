import { NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/session";
import { getItineraryExportData } from "@/lib/itinerary-export-view";
import { renderItineraryPdf } from "@/lib/pdf/itinerary-pdf";
import { OwnershipError } from "@/lib/services/ownership";

/**
 * Itinerary PDF download. Auth + ownership checked before any render; every
 * failure mode collapses to the same generic 404 — no info leak, mirroring
 * app/api/boarding-pass/[bookingId]/route.ts (QA 5.9-style forged-id denial).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const userId = await readSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let data;
  try {
    data = await getItineraryExportData(userId, tripId);
  } catch (error) {
    if (error instanceof OwnershipError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  const buffer = await renderItineraryPdf(data);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="wanderlost-itinerary-${data.tripId}.pdf"`,
    },
  });
}
