"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Honest offline indicator. Yawm is online-first (REQUIREMENTS 4): when the browser is offline it
 * says so clearly rather than pretending writes are saved. Open text drafts stay in their fields.
 */
export function OfflineBanner() {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-500/15 px-4 py-1.5 text-center text-sm text-amber-900 dark:text-amber-200"
    >
      You&rsquo;re offline — changes won&rsquo;t be saved until you reconnect.
    </div>
  );
}
