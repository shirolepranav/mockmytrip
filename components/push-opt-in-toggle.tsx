"use client";

import { useState, useSyncExternalStore } from "react";
import { isNativePlatform } from "@/lib/platform";
import { ToggleSwitch } from "@/components/toggle-switch";

function subscribeNever() {
  return () => {};
}

/*
 * Push opt-in toggle (Phase 8 task 4), shared by Settings and the trip
 * detail page. Notification.requestPermission() is only ever called from
 * this explicit tap — never on load — so opting in is always a deliberate
 * user action (golden rule #3: no auto-opt-in notifications).
 */

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function postSubscription(subscription: PushSubscription) {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
}

async function deleteSubscription(endpoint: string) {
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

export function PushOptInToggle({
  vapidPublicKey,
  initialOptIn,
}: {
  vapidPublicKey?: string;
  initialOptIn: boolean;
}) {
  // One-time browser-capability check — never changes while mounted, so
  // this uses the no-op-subscribe useSyncExternalStore pattern (matching
  // lib/motion/reduced-motion.tsx) rather than an effect + setState.
  const supported = useSyncExternalStore(
    subscribeNever,
    () =>
      !isNativePlatform() &&
      Boolean(vapidPublicKey) &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
    () => false,
  );
  const [optedIn, setOptedIn] = useState(initialOptIn);
  const [pending, setPending] = useState(false);

  if (!supported) {
    return (
      <p className="text-sm text-ink-soft" data-testid="push-opt-in-unavailable">
        Push notifications aren&apos;t available on this device or browser.
      </p>
    );
  }

  async function handleChange(next: boolean) {
    setPending(true);
    try {
      // Never await .ready blindly — if the Service Worker hasn't
      // registered yet (dev, or registration still in flight), that hangs
      // forever instead of failing gracefully.
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setPending(false);
        return;
      }

      if (next) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setPending(false);
          return;
        }
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
        });
        await postSubscription(subscription);
        setOptedIn(true);
      } else {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          await deleteSubscription(endpoint);
        }
        setOptedIn(false);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-s3">
      <ToggleSwitch
        checked={optedIn}
        onChange={handleChange}
        disabled={pending}
        label="Push notifications for countdown milestones"
        testId="push-opt-in-toggle"
      />
      <span className="text-sm">
        {optedIn ? "On — countdown nudges enabled" : "Off"}
      </span>
    </div>
  );
}
