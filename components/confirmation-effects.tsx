"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toast } from "@/components/toast";
import { markFirstBoardingPass } from "@/lib/pwa/install-prompt-state";

/*
 * Confirmation-page side effects: scrub the one-time `justBooked`/
 * `emailStatus` query flags from the URL after mount (so a manual refresh
 * never replays the reveal or re-shows the email toast), and show the
 * email-status toast when relevant. A small client leaf so the page itself
 * can stay a Server Component.
 *
 * This page is also the "first boarding pass" moment the install prompt
 * (Phase 8 task 3, WF §21) waits for — marking it here, idempotently, on
 * every visit (not just a fresh booking) means a guest who saved their
 * pass and comes back to view it later still counts.
 */
export function ConfirmationEffects({
  emailStatus,
}: {
  emailStatus?: "sent" | "skipped" | "failed";
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    markFirstBoardingPass();
    router.replace(pathname);
    // Runs once on mount only — scrubbing is a one-time action, not tied to
    // route-object identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (emailStatus === "failed") {
    return <Toast message="Email couldn't send — your pass lives right here." />;
  }
  if (emailStatus === "sent") {
    return <Toast tone="success" message="Confirmation email sent." />;
  }
  return null;
}
