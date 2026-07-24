import { requireFlightDraft } from "@/lib/hotel-guard";
import { summarizeDraft, generateTripTitle } from "@/lib/trip-summary";
import { TripSegmentCard } from "@/components/trip-segment-card";
import { SavingsTally } from "@/components/savings-tally";
import { CheckoutForm } from "@/components/checkout-form";
import { formatMoney } from "@/lib/format";

/*
 * Fake checkout (WF §10, IMPLEMENTATION_PLAN Phase 5 task 1): order
 * summary, struck-through synthetic total + $0.00 due, "You're saving $X"
 * count-up, a pinned SIMULATION reassurance banner, optional email, and the
 * Confirm CTA. Zero payment/card/billing inputs — see CheckoutForm.
 */

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const draft = await requireFlightDraft();
  const summary = summarizeDraft(draft);
  const title =
    summary.title ??
    generateTripTitle(summary.destinationCity ?? "your trip", summary.nights);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-s5">
      <header className="flex flex-col gap-s2">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          Checkout
        </p>
        <h1 className="font-display text-2xl">{title}</h1>
      </header>

      <div
        data-testid="checkout-simulation-banner"
        className="ticket-surface flex items-center gap-s3 p-s4"
      >
        <span
          aria-hidden
          className="inline-block size-2 shrink-0 rounded-pill bg-stamp-red"
        />
        <p className="text-sm font-semibold text-ink">
          SIMULATION — no payment, no card needed. This isn&apos;t real —
          enjoy it.
        </p>
      </div>

      <div className="flex flex-col gap-s3">
        {summary.flight ? (
          <TripSegmentCard
            kind="flight"
            label={summary.hasReturnFlight ? "Outbound flight" : "Flight"}
            offer={summary.flight}
            editHref="/trip/summary"
          />
        ) : null}
        {summary.returnFlight ? (
          <TripSegmentCard
            kind="flight"
            label="Return flight"
            offer={summary.returnFlight}
            editHref="/trip/summary"
          />
        ) : null}
        {summary.hotel ? (
          <TripSegmentCard
            kind="hotel"
            offer={summary.hotel}
            editHref="/trip/summary"
          />
        ) : null}
      </div>

      <div className="ticket-surface flex flex-col gap-s2 p-s5">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg">Total due</p>
          <div className="text-right">
            <p
              data-testid="checkout-grand-total"
              className="text-sm text-ink-soft line-through"
            >
              {formatMoney(summary.grandTotalCents)}
            </p>
            <p
              data-testid="checkout-due-amount"
              className="font-serif text-3xl font-semibold"
            >
              $0.00
            </p>
          </div>
        </div>
        <p
          data-testid="checkout-total-saved"
          className="text-right text-sm font-semibold text-mint-ok"
        >
          You&apos;re saving{" "}
          <SavingsTally cents={summary.totalSavedCents} />
        </p>
      </div>

      <CheckoutForm />
    </section>
  );
}
