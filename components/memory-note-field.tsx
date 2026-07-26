"use client";

import { useRef, useState } from "react";

/*
 * Reflective note field (Phase 8 task 5): localStorage-only, keyed per
 * trip — the task spec explicitly calls this out as "(local)", and it
 * matches the data-minimalism rule (no schema change for a low-stakes
 * freeform note).
 */

function storageKey(tripId: string): string {
  return `wanderlost.memory-note.${tripId}`;
}

function readNote(tripId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(storageKey(tripId)) ?? "";
  } catch {
    return "";
  }
}

export function MemoryNoteField({ tripId }: { tripId: string }) {
  // Lazy initializer (not an effect + setState): each Memories page render
  // is scoped to one fixed tripId — a different trip is a full route
  // remount, not a prop change on this same instance — so there's no
  // external value to resync with after mount.
  const [note, setNote] = useState(() => readNote(tripId));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    setNote(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey(tripId), value);
      } catch {
        // Storage unavailable (private mode) — the note just won't persist.
      }
    }, 400);
  }

  return (
    <div className="flex flex-col gap-s2">
      <label htmlFor="memory-note" className="text-sm font-semibold">
        A note for yourself
      </label>
      <textarea
        id="memory-note"
        data-testid="memory-note-field"
        value={note}
        onChange={(event) => handleChange(event.target.value)}
        rows={4}
        placeholder="What do you imagine you'd remember most?"
        className="min-h-24 rounded-card border border-line bg-paper2 px-s3 py-s2 font-serif"
      />
      <p className="text-xs text-ink-soft">
        Saved on this device only — never uploaded anywhere.
      </p>
    </div>
  );
}
