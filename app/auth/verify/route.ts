import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLink, InvalidTokenError } from "@/lib/services/auth";
import { readSessionUserId, signSessionValue, SESSION_COOKIE } from "@/lib/auth/session";

/*
 * Magic-link landing: consume the token, merge guest data into the account,
 * set the session cookie, and head to My Trips.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/settings?auth=invalid", request.url));
  }
  try {
    const guestId = await readSessionUserId();
    const accountId = await verifyMagicLink(token, guestId);
    const response = NextResponse.redirect(
      new URL("/trips?auth=signed-in", request.url),
    );
    response.cookies.set(SESSION_COOKIE, signSessionValue(accountId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 400,
      path: "/",
    });
    return response;
  } catch (error) {
    const reason = error instanceof InvalidTokenError ? "invalid" : "error";
    return NextResponse.redirect(
      new URL(`/settings?auth=${reason}`, request.url),
    );
  }
}
