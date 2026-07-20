"use client";

import { useActionState } from "react";
import {
  requestMagicLinkAction,
  type MagicLinkState,
} from "@/actions/auth";

/* Magic-link sign-in / account-upgrade form (Settings). */
export function MagicLinkForm() {
  const [state, formAction, pending] = useActionState<MagicLinkState, FormData>(
    requestMagicLinkAction,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-s3">
      <label htmlFor="magic-email" className="font-semibold">
        Keep my trips (optional)
      </label>
      <p className="text-sm text-ink-soft">
        Add an email to sync your pretend trips across devices. We send a
        sign-in link — no password, no spam.
      </p>
      <div className="flex w-full max-w-sm gap-s2">
        <input
          id="magic-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="min-h-11 flex-1 rounded-card border border-line bg-paper2 px-s3 text-base"
        />
        <button
          type="submit"
          disabled={pending}
          className="press-physical min-h-11 rounded-pill bg-ink px-s4 font-semibold text-paper2 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send link"}
        </button>
      </div>
      {state.status !== "idle" ? (
        <p
          role="status"
          className={
            state.status === "sent" ? "text-mint-ok" : "text-alert"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
