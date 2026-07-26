"use client";

import { useState } from "react";
import { Toast } from "@/components/toast";

/*
 * "Add to calendar" (WF §20d): downloads the .ics from
 * app/api/calendar/[tripId]/route.ts via fetch + blob, rather than a plain
 * `<a href download>`, so a real success/failure signal drives the
 * reassurance toast ("shows as Free, never Busy") instead of guessing.
 * Used on trip detail, confirmation, and the public shared page (with
 * `token` for the latter's session-less auth path).
 */
export function AddToCalendarButton({
  tripId,
  token,
  includeItineraryDays = false,
  label = "Add to calendar",
  className,
}: {
  tripId: string;
  token?: string;
  includeItineraryDays?: boolean;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (includeItineraryDays) params.set("days", "1");
    const query = params.toString();
    const url = `/api/calendar/${tripId}${query ? `?${query}` : ""}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("calendar download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "wanderlost-trip.ics";

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        data-testid="add-to-calendar-button"
        className={
          className ??
          "press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink disabled:opacity-60"
        }
      >
        {status === "loading" ? "Preparing…" : label}
      </button>
      {status === "done" ? (
        <Toast
          key="ics-done"
          tone="success"
          message="Saved — it'll show as Free so no one thinks you're actually away."
        />
      ) : null}
      {status === "error" ? (
        <Toast key="ics-error" message="Couldn't download — give it another tap in a moment." />
      ) : null}
    </>
  );
}
