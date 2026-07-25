"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { drainQueue, queueMutation, type QueuedMutation } from "./mutation-queue";

/*
 * Wires browser online/offline events to the IndexedDB mutation queue
 * (Phase 7 scaffold; full offline reads + a service worker land in
 * Phase 8). `onReplay` runs once per queued mutation when connectivity
 * returns, in the order they were queued.
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

export function useOfflineQueue(onReplay: (mutation: QueuedMutation) => Promise<void>) {
  // useSyncExternalStore (not an effect + setState) — the SSR-safe pattern
  // for subscribing to a browser-only mutable API (mirrors
  // lib/motion/reduced-motion.tsx's prefers-reduced-motion subscription).
  const isOffline = useSyncExternalStore(
    subscribeToConnectivity,
    readIsOffline,
    () => false, // server snapshot: assume online
  );

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
