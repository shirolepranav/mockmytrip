"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { drainQueue, queueMutation, type QueuedMutation } from "./mutation-queue";

/*
 * Wires browser online/offline events to the IndexedDB mutation queue
 * (Phase 7 scaffold; Phase 8 adds the global offline banner + Serwist's
 * shell/asset precaching on top of this same reconnect-sync model — see
 * docs/IMPLEMENTATION_PLAN.md Phase 8 decision notes on offline scope).
 * `onReplay` runs once per queued mutation when connectivity returns, in
 * the order they were queued.
 */

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function readIsOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Whether the browser reports itself offline. useSyncExternalStore (not an
 * effect + setState) — the SSR-safe pattern for subscribing to a
 * browser-only mutable API (mirrors lib/motion/reduced-motion.tsx's
 * prefers-reduced-motion subscription). Shared by the global offline
 * banner and useOfflineQueue below, so there's one source of truth for
 * "are we offline" across the app.
 */
export function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribeToConnectivity,
    readIsOffline,
    () => false, // server snapshot: assume online
  );
}

export function useOfflineQueue(onReplay: (mutation: QueuedMutation) => Promise<void>) {
  const isOffline = useIsOffline();

  // Draining the queue on reconnect is a real side effect (an async
  // operation reacting to a value change), so it stays in an effect.
  useEffect(() => {
    if (!isOffline) void drainQueue(onReplay);
  }, [isOffline, onReplay]);

  const enqueue = useCallback((kind: string, payload: unknown) => {
    return queueMutation(kind, payload);
  }, []);

  return { isOffline, queueMutation: enqueue };
}
