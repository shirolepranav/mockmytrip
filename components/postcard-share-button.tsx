"use client";

import { useState } from "react";
import { Toast } from "@/components/toast";

/*
 * Postcard share (Phase 8 task 5, QA 8.9): Web Share API on mobile (an
 * explicit opt-in tap, never automatic), copy-link fallback on desktop.
 * The shared text always bakes in "SIMULATION" — the same real-world-
 * confusion guard already used for .ics calendar exports — since this
 * text can end up somewhere (a chat, a social post) with no other context
 * telling the recipient nothing was actually booked.
 */
export function PostcardShareButton({ destinationCity }: { destinationCity: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const text = `Just relived my (pretend) trip to ${destinationCity} on Wanderlost — a travel SIMULATION.`;
    const url = window.location.origin;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Wanderlost", text, url });
      } catch {
        // User cancelled the share sheet — not an error.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
    } catch {
      // Clipboard unavailable — nothing more we can do here.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        data-testid="postcard-share-button"
        className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
      >
        Share postcard
      </button>
      {copied ? <Toast tone="success" message="Link copied." /> : null}
    </>
  );
}
