"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Registers the service worker that lets the app open offline.
 * It is skipped in `npm run dev` so cached files never hide your edits;
 * test offline mode with `npm run build && npm start`.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const ready = await navigator.serviceWorker.ready;
        // Tell the worker everything this page loaded so it is all saved.
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(location.origin) && name.includes("/_next/static/"));
        (ready.active ?? registration.active)?.postMessage({ type: "CACHE_URLS", urls });
      } catch {
        // Offline start-up simply will not be available; the app still works online.
      }
    };

    if (document.readyState === "complete") void register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

function subscribe(callback: () => void) {
  if (!("serviceWorker" in navigator)) return () => {};
  navigator.serviceWorker.addEventListener("controllerchange", callback);
  return () => navigator.serviceWorker.removeEventListener("controllerchange", callback);
}

/** True once the app is saved on this device and will open without internet. */
export function useOfflineReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => "serviceWorker" in navigator && navigator.serviceWorker.controller != null,
    () => false,
  );
}
