import Link from "next/link";
import { notFound } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import { getBoardingPassData } from "@/lib/boarding-pass-view";
import { getStampForTrip } from "@/lib/services/trips";
import { OwnershipError } from "@/lib/services/ownership";
import { formatDateInTz } from "@/lib/format";
import { BoardingPassReveal } from "@/components/boarding-pass-reveal";
import { ConfirmationEffects } from "@/components/confirmation-effects";

/*
 * Confirmation / boarding pass (WF §11): the pass, Download PDF, email
 * status, "Start the countdown"/passport CTAs. The reveal set-piece plays
 * only when arriving fresh from checkout (`?justBooked=1`) — a later
 * revisit renders the settled pass instantly, no replay.
 */

export const metadata = { title: "Boarding pass" };

const EMAIL_STATUSES = new Set(["sent", "skipped", "failed"]);

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ justBooked?: string; emailStatus?: string }>;
}) {
  const { bookingId } = await params;
  const search = await searchParams;
  const userId = await readSessionUserId();
  if (!userId) notFound();

  let data;
  try {
    data = await getBoardingPassData(userId, bookingId);
  } catch (error) {
    if (error instanceof OwnershipError) notFound();
    throw error;
  }

  const stampRow = await getStampForTrip(userId, data.tripId);
  const stamp = stampRow
    ? {
        stampStyle: stampRow.stampStyle,
        rotationDeg: stampRow.rotationDeg,
        inkHue: stampRow.inkHue,
        city: stampRow.city,
        countryIso: stampRow.countryIso,
        dateLabel: formatDateInTz(stampRow.stampDate.getTime(), data.destTz),
      }
    : {
        stampStyle: 0,
        rotationDeg: -4,
        inkHue: 200,
        city: data.destCity,
        countryIso: data.destCountry,
        dateLabel: formatDateInTz(data.departUtcMs, data.destTz),
      };

  const justBooked = search.justBooked === "1";
  const emailStatus =
    justBooked && search.emailStatus && EMAIL_STATUSES.has(search.emailStatus)
      ? (search.emailStatus as "sent" | "skipped" | "failed")
      : undefined;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-s6">
      <ConfirmationEffects emailStatus={emailStatus} />

      <header className="flex flex-col items-center gap-s1 text-center">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          Confirmed
        </p>
        <h1 className="font-display text-2xl">Your boarding pass</h1>
      </header>

      <BoardingPassReveal data={data} stamp={stamp} autoPlay={justBooked} />

      <div className="flex flex-wrap items-center justify-center gap-s3">
        <a
          href={`/api/boarding-pass/${data.bookingId}`}
          data-testid="download-pdf-link"
          className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
        >
          Download PDF
        </a>
        <Link
          href="/trips"
          className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill border border-line px-s5 font-semibold text-ink"
        >
          Start the countdown
        </Link>
        <Link
          href="/passport"
          className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill border border-line px-s5 font-semibold text-ink"
        >
          View passport
        </Link>
      </div>

      <p className="text-center text-sm text-ink-soft">
        Already added to My Trips and stamped in your passport — no extra
        steps.
      </p>
    </section>
  );
}
