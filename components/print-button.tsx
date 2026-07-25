"use client";

/* Tiny client leaf so the itinerary print page itself stays a Server Component. */
export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-testid="itinerary-print-button"
      className={className}
    >
      Print
    </button>
  );
}
