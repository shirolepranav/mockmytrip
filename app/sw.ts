import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

/*
 * Serwist service worker (TECH_SPEC §8, Phase 8 task 1). Bundled separately
 * by @serwist/next's webpack plugin (swSrc in next.config.ts) — excluded
 * from tsconfig.json's program because it runs in the Service Worker
 * global scope (ExtendableEvent, etc.), which conflicts with this project's
 * DOM-only `lib` setting used everywhere else.
 *
 * `defaultCache` already covers `/data/*.json` (the slim airports file the
 * airport autocomplete fetches) via its generic `.json` NetworkFirst rule,
 * and every file under public/ — including that same slim JSON — is swept
 * into `precacheEntries` automatically by the webpack plugin's default
 * `globPublicPatterns: ["**\/*"]`, so no extra runtime-caching rule is
 * needed here for it.
 *
 * The offline fallback target is a plain static file (public/offline.html),
 * not an app route: PrecacheFallbackPlugin can only serve a URL that was
 * itself precached at build time (it calls `matchPrecache`, never the
 * runtime cache), and only public/ files are swept into that precache
 * manifest — a rendered Next.js page never is.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher: ({ request }) => request.mode === "navigate",
      },
    ],
  },
});

serwist.addEventListeners();

/*
 * Web push display (Phase 8 task 4). Serwist's own addEventListeners()
 * only wires install/activate/fetch/message — showing a notification for
 * an incoming push, and handling a tap on it, are plain Service Worker
 * APIs layered on top.
 */
interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json() as PushPayload;
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/trips" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/trips";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow?.(url);
    }),
  );
});
