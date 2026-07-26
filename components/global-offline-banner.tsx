"use client";

import { useIsOffline } from "@/lib/offline/use-offline-queue";
import { OfflineBanner } from "@/components/offline-banner";

/*
 * Lifts the offline indicator into the app shell (Phase 8 task 2, WF §21:
 * "global state") so it covers every in-app route, not just the
 * itinerary/packing pages that already had their own offline handling
 * since Phase 7.
 */
export function GlobalOfflineBanner() {
  const isOffline = useIsOffline();
  return <OfflineBanner visible={isOffline} />;
}
