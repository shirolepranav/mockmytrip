"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { updateDraftTitleAction } from "@/actions/trips";

function SavingHint() {
  const { pending } = useFormStatus();
  return pending ? (
    <span aria-live="polite" className="text-xs text-ink-soft">
      Saving…
    </span>
  ) : null;
}

/* Editable auto-title (WF §9, QA 4.9) — saves on blur, persists to the draft. */
export function TripTitleEditor({ initialTitle }: { initialTitle: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={updateDraftTitleAction}
      className="flex flex-wrap items-center gap-s2"
    >
      <label htmlFor="trip-title" className="sr-only">
        Trip title
      </label>
      <input
        id="trip-title"
        name="title"
        type="text"
        defaultValue={initialTitle}
        maxLength={120}
        data-testid="trip-title-input"
        onBlur={() => formRef.current?.requestSubmit()}
        className="min-h-12 flex-1 rounded-card border border-line bg-paper2 px-s3 font-display text-xl"
      />
      <SavingHint />
    </form>
  );
}
