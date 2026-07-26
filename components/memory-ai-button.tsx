"use client";

import { useState } from "react";
import { suggestMemoryAction } from "@/actions/ai";

/*
 * Optional LLM memory paragraph (Phase 8 task 5): same quota/graceful-
 * fallback tone as Phase 7's AI itinerary suggestions — any failure shows
 * a friendly message and never blocks the manual reflective-note field
 * right below it.
 */
export function MemoryAiButton({
  tripId,
  city,
  days,
}: {
  tripId: string;
  city: string;
  days: number;
}) {
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "done"; paragraph: string } | { status: "error"; message: string }
  >({ status: "idle" });

  async function handleClick() {
    setState({ status: "loading" });
    const result = await suggestMemoryAction({ tripId, city, days });
    if (result.status === "ok" && result.paragraph) {
      setState({ status: "done", paragraph: result.paragraph });
    } else {
      setState({
        status: "error",
        message: result.message ?? "The travel muse is resting — try again later.",
      });
    }
  }

  if (state.status === "done") {
    return (
      <p data-testid="memory-ai-paragraph" className="font-serif text-ink italic">
        {state.paragraph}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-s2">
      <button
        type="button"
        onClick={handleClick}
        disabled={state.status === "loading"}
        data-testid="memory-ai-button"
        className="press-physical inline-flex min-h-11 w-fit items-center rounded-pill border border-line px-s5 font-semibold text-ink disabled:opacity-60"
      >
        {state.status === "loading" ? "Writing…" : "Write my memory"}
      </button>
      {state.status === "error" ? (
        <p role="status" className="text-sm text-ink-soft">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
