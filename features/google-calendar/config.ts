import "server-only";
import { hkdfSync } from "node:crypto";

/**
 * Google Calendar is optional. It is on only when GOOGLE_CALENDAR_INTEGRATION_ENABLED is "true"
 * and every server-side credential is present and valid; otherwise the app behaves exactly as it
 * does without Google (manual scheduling keeps working).
 *
 * Server-only: these values must never reach a client component or a NEXT_PUBLIC_* variable.
 */

/** The narrowest scopes for this feature: list calendars, and manage events on calendars the user owns. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.owned",
] as const;

export type GoogleEndpoints = {
  authorize: string;
  token: string;
  revoke: string;
  calendarApi: string;
};

const GOOGLE_ENDPOINTS: GoogleEndpoints = {
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revoke: "https://oauth2.googleapis.com/revoke",
  calendarApi: "https://www.googleapis.com/calendar/v3",
};

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Encrypts refresh/access tokens at rest. */
  tokenKey: Buffer;
  /** Encrypts the short-lived OAuth state cookie. Derived, so one secret serves both. */
  stateKey: Buffer;
  endpoints: GoogleEndpoints;
};

export type GoogleConfigResult =
  | { enabled: true; config: GoogleConfig }
  | { enabled: false; reason: "disabled" | "misconfigured"; problems: string[] };

type GoogleEnv = Readonly<Record<string, string | undefined>>;

function isLoopback(url: URL) {
  return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
}

/**
 * Test-only: points every Google endpoint at a local mock server. Accepted only for a loopback
 * http:// origin, so a misconfiguration can never send credentials to another host.
 */
function endpointsFor(override: string | undefined, problems: string[]): GoogleEndpoints {
  if (!override) return GOOGLE_ENDPOINTS;
  try {
    const url = new URL(override);
    if (!isLoopback(url)) throw new Error();
    const origin = url.origin;
    return {
      authorize: `${origin}/o/oauth2/v2/auth`,
      token: `${origin}/token`,
      revoke: `${origin}/revoke`,
      calendarApi: `${origin}/calendar/v3`,
    };
  } catch {
    problems.push("GOOGLE_API_ORIGIN_OVERRIDE must be an http://localhost or 127.0.0.1 origin.");
    return GOOGLE_ENDPOINTS;
  }
}

function derive(key: Buffer, label: string): Buffer {
  return Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), `yawm:${label}`, 32));
}

export function getGoogleConfig(env: GoogleEnv = process.env): GoogleConfigResult {
  if (env.GOOGLE_CALENDAR_INTEGRATION_ENABLED?.trim().toLowerCase() !== "true") {
    return { enabled: false, reason: "disabled", problems: [] };
  }
  const problems: string[] = [];
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim() ?? "";
  const rawKey = env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() ?? "";

  if (!clientId) problems.push("GOOGLE_CLIENT_ID is not set.");
  if (!clientSecret) problems.push("GOOGLE_CLIENT_SECRET is not set.");

  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "https:" && !isLoopback(url)) throw new Error();
    if (!url.pathname.endsWith("/api/integrations/google-calendar/callback")) throw new Error();
  } catch {
    problems.push(
      "GOOGLE_REDIRECT_URI must be https:// (http:// only for localhost) and end with /api/integrations/google-calendar/callback.",
    );
  }

  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) {
    problems.push(
      "GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (`openssl rand -base64 32`).",
    );
  }

  const endpoints = endpointsFor(env.GOOGLE_API_ORIGIN_OVERRIDE?.trim() || undefined, problems);
  if (problems.length) return { enabled: false, reason: "misconfigured", problems };

  return {
    enabled: true,
    config: {
      clientId,
      clientSecret,
      redirectUri,
      tokenKey: derive(key, "google-tokens"),
      stateKey: derive(key, "google-oauth-state"),
      endpoints,
    },
  };
}
