"use client";

import { useRef, useState } from "react";
import { renameTripAction, deleteTripAction } from "@/actions/trips";
import { IconMore } from "@/components/icons";

/*
 * Trip overflow menu (WF §12): rename inline, delete with a plain confirm —
 * no confirm-shaming copy, no streak/loss framing (golden rule #3). Rendered
 * as a sibling of the trip card's link, never nested inside an <a>.
 */
export function TripCardMenu({
  tripId,
  title,
}: {
  tripId: string;
  title: string;
}) {
  const [mode, setMode] = useState<"closed" | "menu" | "rename" | "delete">(
    "closed",
  );
  const formRef = useRef<HTMLFormElement>(null);

  if (mode === "closed") {
    return (
      <button
        type="button"
        onClick={() => setMode("menu")}
        aria-label={`More options for ${title}`}
        data-testid="trip-card-menu-button"
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-pill text-ink-soft hover:bg-paper2"
      >
        <IconMore size={20} />
      </button>
    );
  }

  if (mode === "menu") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMode("closed")}
          aria-label="Close menu"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-pill text-ink-soft hover:bg-paper2"
        >
          <IconMore size={20} />
        </button>
        <div
          data-testid="trip-card-menu"
          className="ticket-surface absolute right-0 top-full z-20 flex w-40 flex-col p-s2"
        >
          <button
            type="button"
            onClick={() => setMode("rename")}
            className="min-h-11 rounded-card px-s3 text-left text-sm font-semibold hover:bg-paper2"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => setMode("delete")}
            className="min-h-11 rounded-card px-s3 text-left text-sm font-semibold text-alert hover:bg-paper2"
          >
            Delete trip
          </button>
        </div>
      </div>
    );
  }

  if (mode === "rename") {
    return (
      <form
        ref={formRef}
        action={renameTripAction}
        onSubmit={() => setMode("closed")}
        className="flex items-center gap-s2"
      >
        <input type="hidden" name="tripId" value={tripId} />
        <label className="sr-only" htmlFor={`rename-${tripId}`}>
          Trip title
        </label>
        <input
          id={`rename-${tripId}`}
          name="title"
          type="text"
          defaultValue={title}
          maxLength={120}
          autoFocus
          data-testid="trip-rename-input"
          className="min-h-11 w-40 rounded-card border border-line bg-paper2 px-s3 text-sm"
        />
        <button
          type="submit"
          data-testid="trip-rename-save"
          className="min-h-11 rounded-pill bg-ink px-s3 text-sm font-semibold text-paper2"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setMode("closed")}
          className="min-h-11 rounded-pill px-s3 text-sm font-semibold text-ink-soft hover:bg-paper2"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-s2">
      <p className="text-sm text-ink-soft">Delete this trip? There&apos;s no undo.</p>
      <form action={deleteTripAction}>
        <input type="hidden" name="tripId" value={tripId} />
        <button
          type="submit"
          data-testid="trip-delete-confirm"
          className="min-h-11 rounded-pill bg-alert px-s3 text-sm font-semibold text-paper2"
        >
          Yes, delete
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode("closed")}
        className="min-h-11 rounded-pill px-s3 text-sm font-semibold text-ink-soft hover:bg-paper2"
      >
        Cancel
      </button>
    </div>
  );
}
