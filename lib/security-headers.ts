/**
 * Conservative security response headers applied to every route (see next.config.ts). These are
 * safe defaults that don't depend on the app's own origins. A Content-Security-Policy is
 * intentionally omitted here: it needs per-deployment tuning (Supabase, Google, fonts) and is
 * better added once those origins are fixed in production.
 */
export const securityHeaders: { key: string; value: string }[] = [
  // Don't let browsers guess content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The app is never meant to be embedded in a frame.
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin on cross-origin navigations; full path same-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny powerful features the app doesn't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Enforce HTTPS in production; browsers ignore this over plain http (e.g. localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];
