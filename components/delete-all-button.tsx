"use client";

import { useState } from "react";
import { deleteAllDataAction } from "@/actions/user";

/*
 * Hard delete with a plain confirm — no confirm-shaming (golden rule #3).
 */
export function DeleteAllButton() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 rounded-pill border-2 border-alert px-s4 font-semibold text-alert hover:bg-alert hover:text-paper2"
      >
        Delete all my data
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-s3">
      <p className="text-sm text-ink-soft">
        Deletes every trip, stamp, and setting. There&apos;s no undo.
      </p>
      <form action={deleteAllDataAction}>
        <button
          type="submit"
          className="min-h-11 rounded-pill bg-alert px-s4 font-semibold text-paper2"
        >
          Yes, delete everything
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-11 rounded-pill px-s4 font-semibold text-ink-soft hover:bg-paper2"
      >
        Cancel
      </button>
    </div>
  );
}
