"use client";

import { useEffect } from "react";
import { isNativePlatform } from "@/lib/platform";

/*
 * Manual Service Worker registration (Phase 8 task 1, TECH_SPEC §12.5).
 * Registered explicitly here — rather than Serwist's own `register: true`
 * option — so the native-platform guard runs first: a future Capacitor
 * build must never register a web Service Worker (unreliable in iOS
 * WKWebView; native push/offline plugins replace it there instead).
 * Production-only: `next.config.ts` disables the Serwist build itself in
 * dev, so `/sw.js` wouldn't exist to register anyway, but the explicit
 * NODE_ENV check keeps this component's intent self-evident.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (isNativePlatform()) return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal — the app works fully without
      // an installed Service Worker, just without offline/install support.
    });
  }, []);

  return null;
}
