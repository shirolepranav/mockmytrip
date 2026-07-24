"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteTripAction, renameTripAction } from "@/actions/trips";
import { IconMore, IconTrash } from "@/components/icons";

/*
 * Trip card overflow: Rename / Delete (WF §12). Rename mirrors
 * trip-title-editor.tsx's save-on-blur pattern; delete mirrors
 * delete-all-button.tsx's plain-confirm-no-shaming state machine — no
 * modal, no scary copy (golden rule #3).
 */

type MenuState = "idle" | "menu" | "renaming" | "confirming-delete";

function SavingHint() {
  const { pending } = useFormStatus();
  return pending ? (
    <span aria-live="polite" className="text-xs text-ink-soft">
      Saving…
    </span>
  ) : null;
}

export function TripCardMenu({
  tripId,
  title,
}: {
  tripId: string;
  title: string;
}) {
  const [state, setState] = useState<MenuState>("idle");
  const renameFormRef = useRef<HTMLFormElement>(null);

  if (state === "renaming") {
    return (
      <form
        ref={renameFormRef}
        action={renameTripAction}
        className="ticket-surface flex items-center gap-s2 p-s2"
      >
        <input type="hidden" name="tripId" value={tripId} />
        <label htmlFor={`trip-title-${tripId}`} className="sr-only">
          Trip title
        </label>
        <input
          id={`trip-title-${tripId}`}
          name="title"
          type="text"
          defaultValue={title}
          maxLength={120}
          autoFocus
          data-testid="trip-rename-input"
          onBlur={() => {
            renameFormRef.current?.requestSubmit();
            setState("idle");
          }}
          className="min-h-9 min-w-0 flex-1 rounded-sharp border border-line bg-paper px-s2 text-sm"
        />
        <SavingHint />
      </form>
    );
  }

  if (state === "confirming-delete") {
    return (
      <div className="ticket-surface flex flex-col gap-s2 p-s3">
        <p className="text-xs text-ink-soft">
          Deletes this trip. There&apos;s no undo.
        </p>
        <div className="flex items-center gap-s2">
          <form action={deleteTripAction}>
            <input type="hidden" name="tripId" value={tripId} />
            <button
              type="submit"
              data-testid="trip-delete-confirm"
              className="min-h-9 rounded-pill bg-alert px-s3 text-xs font-semibold text-paper2"
            >
              Yes, delete
            </button>
          </form>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="min-h-9 rounded-pill px-s3 text-xs font-semibold text-ink-soft hover:bg-paper"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state === "menu") {
    return (
      <div className="ticket-surface flex flex-col gap-s1 p-s2" role="menu">
        <button
          type="button"
          role="menuitem"
          onClick={() => setState("renaming")}
          className="flex min-h-9 items-center rounded-sharp px-s2 text-left text-sm hover:bg-paper"
        >
          Rename
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => setState("confirming-delete")}
          className="flex min-h-9 items-center gap-s1 rounded-sharp px-s2 text-left text-sm text-alert hover:bg-paper"
        >
          <IconTrash size={16} />
          Delete
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState("menu")}
      aria-haspopup="true"
      aria-expanded={false}
      aria-label={`More options for ${title}`}
      data-testid="trip-card-menu-trigger"
      className="flex size-11 items-center justify-center rounded-pill bg-paper2/90 text-ink shadow-e1 hover:bg-paper2"
    >
      <IconMore size={20} />
    </button>
  );
}
