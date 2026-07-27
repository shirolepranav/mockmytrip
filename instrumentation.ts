import { captureRequestError, init } from "@sentry/nextjs";

/*
 * Next.js instrumentation hook — runs once per server runtime at boot.
 * Two responsibilities (Phase 10 launch-readiness):
 *
 *  1. Fail fast in production if AUTH_SECRET is missing. Without this,
 *     lib/auth/session.ts's secret() throws lazily on the first request
 *     instead — better to crash loudly at cold start than serve even one
 *     forgeable session.
 *  2. Initialize Sentry for server-side error tracking — see
 *     instrumentation-client.ts for the client-side init and the shared
 *     ethics-guardrails rationale (crash reporting only, never analytics
 *     or behavior tracking; TECH_SPEC §11 bans third-party trackers).
 */
export async function register() {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    throw new Error(
      "FATAL: AUTH_SECRET must be set in production (see .env.example).",
    );
  }

  // No Node server exists under the Capacitor static-export build — there's
  // nothing for Sentry to report from there (TECH_SPEC §12.6).
  if (process.env.NEXT_PUBLIC_IS_NATIVE === "true") return;

  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    init({
      dsn: process.env.SENTRY_DSN,
      // Error tracking only — no Session Replay, no analytics/Insights
      // add-ons. A low trace sample rate aggregates latency, which is not
      // behavior tracking, so it's fine to leave on.
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }
        // Keep only the opaque internal userId, never the optional email.
        if (event.user?.id) {
          event.user = { id: event.user.id };
        } else {
          delete event.user;
        }
        return event;
      },
    });
  }
}

export const onRequestError = captureRequestError;
