"use client";

import { useEffect } from "react";
import { captureException } from "@sentry/nextjs";
import "./globals.css";

/*
 * Root error boundary (Phase 10 — didn't exist before). Next.js implicitly
 * wraps the whole app in a boundary equivalent to this file; when nothing
 * more specific catches an error, this is what renders. It reports the
 * crash to Sentry, then shows a warm, on-brand fallback instead of a raw
 * crash screen — must define its own <html>/<body> since it fully replaces
 * the root layout when it triggers.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-s4 bg-paper px-s5 text-center text-ink">
        <p className="font-mono text-xs font-semibold tracking-widest text-stamp-red uppercase">
          Simulation hiccup
        </p>
        <h1 className="font-display text-2xl">Well, that&apos;s a first.</h1>
        <p className="max-w-prose text-sm text-ink-soft">
          Something went sideways on our end — nothing you did, and nothing
          real was lost (it&apos;s all pretend anyway). Try again in a
          moment.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="press-physical mt-s2 min-h-11 rounded-pill bg-ink px-s6 font-semibold text-paper2"
        >
          Reload
        </button>
      </body>
    </html>
  );
}
