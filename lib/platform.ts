/*
 * Native-platform detection (TECH_SPEC §12.3/§12.5). Web-only features —
 * Service Worker registration, web push, the install prompt — must never
 * run inside a future Capacitor-wrapped build, where a real WKWebView/
 * Chromium-native shell replaces them with native plugins.
 *
 * `@capacitor/core` isn't installed yet (the native wrap is future work),
 * so this checks for its runtime global directly (present only once a
 * Capacitor build actually injects it) and otherwise falls back to the
 * build-time flag `next.config.ts` already branches its static-export
 * output on.
 */

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export function isNativePlatform(): boolean {
  if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform) {
    return window.Capacitor.isNativePlatform();
  }
  return process.env.NEXT_PUBLIC_IS_NATIVE === "true";
}
