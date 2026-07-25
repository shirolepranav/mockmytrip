"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { suggestItineraryAction } from "@/actions/ai";
import type { ItineraryCategory } from "@/lib/services/itinerary";

/*
 * "AI suggest itinerary" (WF §14, Phase 7 task 4): optional, strictly
 * additive — every failure mode (quota, provider unavailable) shows a
 * friendly message here and never touches the itinerary tables, so manual
 * authoring is completely unaffected either way.
 */

export interface AiSuggestedItem {
  dayIndex: number;
  time?: string;
  title: string;
  category: ItineraryCategory;
  note?: string;
  poiId?: string;
}

type Status = "idle" | "loading" | "ok" | "quota" | "unavailable";

export function AiSuggestButton({
  tripId,
  city,
  days,
  onAccept,
}: {
  tripId: string;
  city: string;
  days: number;
  onAccept: (items: AiSuggestedItem[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [items, setItems] = useState<AiSuggestedItem[]>([]);
  const [message, setMessage] = useState("");

  async function handleOpen() {
    setOpen(true);
    setStatus("loading");
    const result = await suggestItineraryAction({ tripId, city, days });
    if (result.status === "ok" && result.items) {
      setItems(result.items);
      setStatus("ok");
    } else if (result.status === "quota") {
      setMessage(result.message ?? "");
      setStatus("quota");
    } else {
      setMessage(result.message ?? "The travel muse is resting — try again later");
      setStatus("unavailable");
    }
  }

  function handleAccept() {
    onAccept(items);
    setOpen(false);
    setStatus("idle");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        data-testid="ai-suggest-button"
        className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink hover:bg-paper2"
      >
        AI suggest itinerary
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="AI suggestions"
        testId="ai-suggest-sheet"
      >
        {status === "loading" ? (
          <p
            data-testid="ai-suggest-loading"
            role="status"
            className="text-sm text-ink-soft"
          >
            The travel muse is dreaming up ideas…
          </p>
        ) : null}
        {status === "quota" ? (
          <p
            data-testid="ai-suggest-quota"
            role="alert"
            className="text-sm text-ink-soft"
          >
            {message}
          </p>
        ) : null}
        {status === "unavailable" ? (
          <p
            data-testid="ai-suggest-unavailable"
            role="alert"
            className="text-sm text-ink-soft"
          >
            {message}
          </p>
        ) : null}
        {status === "ok" ? (
          <div className="flex flex-col gap-s3">
            <ul className="flex flex-col gap-s2" data-testid="ai-suggest-items">
              {items.map((item, index) => (
                <li key={index} className="ticket-surface p-s3 text-sm">
                  <span className="font-semibold">
                    Day {item.dayIndex + 1}: {item.title}
                  </span>
                  {item.note ? <p className="text-xs text-ink-soft">{item.note}</p> : null}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleAccept}
              data-testid="ai-suggest-accept"
              className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
            >
              Accept all
            </button>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
