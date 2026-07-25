/* Persistent "offline" indicator (WF §21 global state) — shared by the
   itinerary board and packing list, the two Phase 7 surfaces with an
   offline mutation queue. */
export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p
      role="status"
      data-testid="offline-banner"
      className="rounded-card border border-line bg-paper2 px-s4 py-s2 text-sm font-semibold text-ink-soft"
    >
      You&apos;re offline — changes will sync when you&apos;re back online.
    </p>
  );
}
