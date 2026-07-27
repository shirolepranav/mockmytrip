import { NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/session";
import { getBoardingPassData } from "@/lib/boarding-pass-view";
import { renderBoardingPassPdf } from "@/lib/pdf/boarding-pass-pdf";
import { OwnershipError } from "@/lib/services/ownership";

/**
 * Boarding-pass PDF download. Auth + ownership checked before any render;
 * every failure mode (no session, forged/foreign bookingId, hotel-type
 * booking) collapses to the same generic 404 — no info leak (QA 5.9).
 *
 * Not usable under static export (dynamic [bookingId] param plus the live
 * session) — see TECH_SPEC §12.6. Deliberately not marked
 * `force-static`/given a `generateStaticParams`: neither actually
 * satisfies Next's static exporter for this route shape (confirmed
 * empirically — `generateStaticParams() { return [] }` doesn't count, and
 * `force-static` freezes the route at build time and breaks it in the
 * real web build, which shares this export).
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const userId = await readSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let data;
  try {
    data = await getBoardingPassData(userId, bookingId);
  } catch (error) {
    if (error instanceof OwnershipError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  const buffer = await renderBoardingPassPdf(data);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="wanderlost-${data.pnr}.pdf"`,
    },
  });
}
