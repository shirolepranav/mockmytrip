"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeShareAction, leaveTripAction } from "@/actions/shares";
import type { OwnedShareView, CollaboratingTripView } from "@/lib/services/shares";

/*
 * Settings "Sharing" card (Phase 9 task 10): manage every share link this
 * user owns in one place, and leave any trip they were invited to. Same
 * plain-confirm, no-shaming pattern as DeleteAllButton.
 */
export function SettingsSharing({
  initialShares,
  initialCollaborations,
}: {
  initialShares: OwnedShareView[];
  initialCollaborations: CollaboratingTripView[];
}) {
  const [confirmingShareId, setConfirmingShareId] = useState<string | null>(null);
  const [confirmingTripId, setConfirmingTripId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleRevoke(shareId: string, tripId: string) {
    setConfirmingShareId(null);
    startTransition(async () => {
      await revokeShareAction({ shareId, tripId });
      router.refresh();
    });
  }

  function handleLeave(tripId: string) {
    setConfirmingTripId(null);
    startTransition(async () => {
      await leaveTripAction({ tripId });
      router.refresh();
    });
  }

  const activeShares = initialShares.filter((share) => !share.isRevoked);

  if (activeShares.length === 0 && initialCollaborations.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        You haven&apos;t shared any trips, and no one has shared one with you — yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-s4">
      {activeShares.length > 0 ? (
        <div className="flex flex-col gap-s2">
          <h3 className="text-sm font-semibold text-ink-soft uppercase">Links you&apos;ve shared</h3>
          {activeShares.map((share) => (
            <div
              key={share.id}
              data-testid="settings-share-row"
              className="flex flex-wrap items-center justify-between gap-s2 rounded-card border border-line px-s3 py-s2"
            >
              <span className="min-w-0 truncate text-sm">
                {share.tripTitle} · {share.destinationCity}
              </span>
              {confirmingShareId === share.id ? (
                <div className="flex items-center gap-s2">
                  <button
                    type="button"
                    onClick={() => handleRevoke(share.id, share.tripId)}
                    className="min-h-11 rounded-pill bg-alert px-s3 text-sm font-semibold text-paper2"
                  >
                    Yes, revoke
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingShareId(null)}
                    className="min-h-11 rounded-pill px-s3 text-sm font-semibold text-ink-soft hover:bg-paper2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingShareId(share.id)}
                  className="min-h-11 rounded-pill px-s3 text-sm font-semibold text-alert hover:bg-paper2"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {initialCollaborations.length > 0 ? (
        <div className="flex flex-col gap-s2">
          <h3 className="text-sm font-semibold text-ink-soft uppercase">Trips shared with you</h3>
          {initialCollaborations.map(({ trip, ownerDisplayName }) => (
            <div
              key={trip.id}
              data-testid="settings-collaboration-row"
              className="flex flex-wrap items-center justify-between gap-s2 rounded-card border border-line px-s3 py-s2"
            >
              <span className="min-w-0 truncate text-sm">
                {trip.title} — shared by {ownerDisplayName ?? "a friend"}
              </span>
              {confirmingTripId === trip.id ? (
                <div className="flex items-center gap-s2">
                  <button
                    type="button"
                    onClick={() => handleLeave(trip.id)}
                    className="min-h-11 rounded-pill bg-alert px-s3 text-sm font-semibold text-paper2"
                  >
                    Yes, leave
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingTripId(null)}
                    className="min-h-11 rounded-pill px-s3 text-sm font-semibold text-ink-soft hover:bg-paper2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingTripId(trip.id)}
                  className="min-h-11 rounded-pill px-s3 text-sm font-semibold text-ink-soft hover:bg-paper2"
                >
                  Leave
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
