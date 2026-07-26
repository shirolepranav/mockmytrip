"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { isNativePlatform } from "@/lib/platform";
import {
  hasFirstBoardingPass,
  isDismissSuppressed,
  recordDismissal,
} from "@/lib/pwa/install-prompt-state";
import { Sheet } from "@/components/sheet";

/*
 * Contextual install prompt (Phase 8 task 3, WF §21: "contextual,
 * non-nagging, dismissible; only after a delightful moment"). Chrome/
 * Android exposes `beforeinstallprompt`; iOS Safari never fires it at all
 * (no native install API), so it gets an instructional "Add to Home
 * Screen" fallback instead of silently doing nothing.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari's own non-standard standalone flag.
  return Boolean((window.navigator as { standalone?: boolean }).standalone);
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !isStandalone();
}

interface GateState {
  /** True when the prompt should never show at all this session. */
  blocked: boolean;
  isIos: boolean;
}

const SERVER_GATE: GateState = { blocked: true, isIos: false };

function subscribeNever() {
  return () => {};
}

function computeGate(): GateState {
  if (isNativePlatform() || isStandalone()) return { blocked: true, isIos: false };
  if (!hasFirstBoardingPass() || isDismissSuppressed()) return { blocked: true, isIos: false };
  return { blocked: false, isIos: isIosSafari() };
}

// useSyncExternalStore requires getSnapshot to return a referentially
// stable value when nothing has changed (it compares via Object.is) — a
// fresh object literal every call trips React's "getSnapshot should be
// cached" infinite-loop guard, even though the underlying booleans are
// identical. This client-only browser-capability read genuinely can
// change across a render (e.g. markFirstBoardingPass() flips it after a
// client-side navigation re-renders this component via usePathname()), so
// it can't just be computed once — cache the last object and only
// allocate a new one when a value actually differs.
let cachedGate: GateState = SERVER_GATE;

function readGate(): GateState {
  const next = computeGate();
  if (next.blocked === cachedGate.blocked && next.isIos === cachedGate.isIos) {
    return cachedGate;
  }
  cachedGate = next;
  return cachedGate;
}

export function InstallPrompt() {
  const pathname = usePathname();
  const gate = useSyncExternalStore(subscribeNever, readGate, () => SERVER_GATE);
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (gate.blocked || gate.isIos) return;
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, [gate.blocked, gate.isIos]);

  const showIosHelp = !gate.blocked && gate.isIos;
  // Never stack with the boarding-pass reveal itself — surface on the next
  // navigation instead, so the celebratory moment stays uncluttered.
  const onConfirmationPage = pathname.startsWith("/trip/confirmation");
  const open = !dismissed && !onConfirmationPage && (Boolean(deferredEvent) || showIosHelp);

  function handleDismiss() {
    recordDismissal();
    setDismissed(true);
  }

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }

  return (
    <Sheet open={open} onClose={handleDismiss} title="Install Wanderlost" testId="install-prompt">
      {showIosHelp ? (
        <div className="flex flex-col gap-s3">
          <p className="text-sm text-ink-soft">
            Add Wanderlost to your home screen for quick access and offline
            reading of your trips.
          </p>
          <ol className="flex flex-col gap-s2 text-sm">
            <li>1. Tap the Share icon in Safari&apos;s toolbar.</li>
            <li>2. Choose &ldquo;Add to Home Screen&rdquo;.</li>
          </ol>
        </div>
      ) : (
        <div className="flex flex-col gap-s3">
          <p className="text-sm text-ink-soft">
            Install Wanderlost for quick access and offline reading of your
            trips.
          </p>
          <button
            type="button"
            onClick={handleInstall}
            data-testid="install-prompt-confirm"
            className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
          >
            Install
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        data-testid="install-prompt-dismiss"
        className="min-h-11 rounded-pill px-s4 font-semibold text-ink-soft hover:bg-paper2"
      >
        Not now
      </button>
    </Sheet>
  );
}
