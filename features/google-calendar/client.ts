import "server-only";
import { z } from "zod";
import { GOOGLE_SCOPES, type GoogleConfig } from "./config";

/**
 * A small typed client for the few Google endpoints this app uses. `fetch` is injectable so
 * tests can simulate Google. Responses are validated before use. Nothing here logs; errors carry
 * a category and status only, never tokens or event content.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 10_000;

export type GoogleErrorKind =
  /** The refresh token was revoked or expired: the user must reconnect. */
  | "revoked"
  /** The access token was rejected (refresh and retry once). */
  | "unauthorized"
  /** A scope is missing or the calendar is no longer writable. */
  | "forbidden"
  /** Quota or rate limit: back off. */
  | "rate_limited"
  | "not_found"
  | "conflict"
  /** Network error, timeout, or 5xx: safe to retry later. */
  | "unavailable"
  /** Anything else, including a malformed response. */
  | "invalid";

export class GoogleApiError extends Error {
  constructor(
    readonly kind: GoogleErrorKind,
    readonly status: number | null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(`Google Calendar request failed (${kind}${status ? `, HTTP ${status}` : ""})`);
    this.name = "GoogleApiError";
  }
}

const RATE_LIMIT_REASONS = new Set([
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "quotaExceeded",
  "dailyLimitExceeded",
]);

const apiErrorSchema = z.object({
  error: z.object({ errors: z.array(z.object({ reason: z.string().optional() })).optional() }),
});
const oauthErrorSchema = z.object({ error: z.string() });

function retryAfter(response: Response): number | null {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? Math.min(value, 3600) : null;
}

async function apiError(response: Response): Promise<GoogleApiError> {
  const { status } = response;
  const body: unknown = await response.json().catch(() => null);
  const reasons = apiErrorSchema.safeParse(body).data?.error.errors?.map((e) => e.reason) ?? [];
  if (status === 429 || (status === 403 && reasons.some((r) => r && RATE_LIMIT_REASONS.has(r)))) {
    return new GoogleApiError("rate_limited", status, retryAfter(response));
  }
  if (status === 401) return new GoogleApiError("unauthorized", status);
  if (status === 403) return new GoogleApiError("forbidden", status);
  if (status === 404 || status === 410) return new GoogleApiError("not_found", status);
  if (status === 409) return new GoogleApiError("conflict", status);
  if (status >= 500) return new GoogleApiError("unavailable", status);
  return new GoogleApiError("invalid", status);
}

async function oauthError(response: Response): Promise<GoogleApiError> {
  const body: unknown = await response.json().catch(() => null);
  const code = oauthErrorSchema.safeParse(body).data?.error;
  if (code === "invalid_grant") return new GoogleApiError("revoked", response.status);
  if (response.status === 429) return new GoogleApiError("rate_limited", 429, retryAfter(response));
  if (response.status >= 500) return new GoogleApiError("unavailable", response.status);
  return new GoogleApiError("invalid", response.status);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new GoogleApiError("invalid", null);
  return result.data;
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});

export type TokenGrant = {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  refreshToken: string | null;
  scopes: string[];
};

const calendarListSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        summary: z.string().optional(),
        summaryOverride: z.string().optional(),
        primary: z.boolean().optional(),
        accessRole: z.string(),
      }),
    )
    .default([]),
  nextPageToken: z.string().optional(),
});

export type GoogleCalendar = { id: string; name: string; primary: boolean; accessRole: string };

const eventTimeSchema = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
  timeZone: z.string().optional(),
});

const eventSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  summary: z.string().optional(),
  start: eventTimeSchema.optional(),
  end: eventTimeSchema.optional(),
  transparency: z.string().optional(),
  visibility: z.string().optional(),
  extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional(),
});

export type GoogleEvent = z.infer<typeof eventSchema>;

const eventListSchema = z.object({
  items: z.array(eventSchema).default([]),
  nextPageToken: z.string().optional(),
});

/** Exactly the fields this app writes. Notes and task details are never sent. */
export type EventWrite = {
  id: string;
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  status: "confirmed";
  transparency: "opaque";
  extendedProperties: { private: { yawmBlockId: string } };
};

const MAX_PAGES = 5;

export function googleClient(config: GoogleConfig, fetchImpl: FetchLike = fetch) {
  const { endpoints } = config;

  async function send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new GoogleApiError("unavailable", null);
    }
  }

  async function tokenRequest(params: Record<string, string>): Promise<TokenGrant> {
    const response = await send(endpoints.token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        ...params,
      }).toString(),
    });
    if (!response.ok) throw await oauthError(response);
    const grant = parse(tokenSchema, await response.json().catch(() => null));
    return {
      accessToken: grant.access_token,
      expiresAt: Date.now() + grant.expires_in * 1000,
      refreshToken: grant.refresh_token ?? null,
      scopes: grant.scope?.split(" ").filter(Boolean) ?? [],
    };
  }

  async function api(
    accessToken: string,
    path: string,
    init: RequestInit & { query?: Record<string, string> } = {},
  ): Promise<Response> {
    const url = new URL(`${endpoints.calendarApi}${path}`);
    for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
    const response = await send(url.toString(), {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      body: init.body,
    });
    if (!response.ok) throw await apiError(response);
    return response;
  }

  const calendarPath = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}`;

  return {
    authorizeUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
      const url = new URL(endpoints.authorize);
      url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: GOOGLE_SCOPES.join(" "),
        // A refresh token is needed for sync; "consent" makes Google issue one on reconnect too.
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "false",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();
      return url.toString();
    },

    exchangeCode(code: string, codeVerifier: string) {
      return tokenRequest({
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
        redirect_uri: config.redirectUri,
      });
    },

    refreshAccessToken(refreshToken: string) {
      return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
    },

    /** Best effort: the caller deletes local tokens whether or not this succeeds. */
    async revokeToken(token: string): Promise<boolean> {
      const response = await send(endpoints.revoke, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }).toString(),
      }).catch(() => null);
      return Boolean(response?.ok);
    },

    async listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
      const calendars: GoogleCalendar[] = [];
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = await api(accessToken, "/users/me/calendarList", {
          query: {
            maxResults: "250",
            fields: "items(id,summary,summaryOverride,primary,accessRole),nextPageToken",
            ...(pageToken ? { pageToken } : {}),
          },
        });
        const list = parse(calendarListSchema, await response.json().catch(() => null));
        for (const c of list.items) {
          calendars.push({
            id: c.id,
            name: (c.summaryOverride ?? c.summary ?? c.id).slice(0, 300),
            primary: c.primary === true,
            accessRole: c.accessRole,
          });
        }
        pageToken = list.nextPageToken;
        if (!pageToken) break;
      }
      return calendars;
    },

    async listEvents(
      accessToken: string,
      calendarId: string,
      range: { timeMin: string; timeMax: string },
    ): Promise<GoogleEvent[]> {
      const events: GoogleEvent[] = [];
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = await api(accessToken, `${calendarPath(calendarId)}/events`, {
          query: {
            timeMin: range.timeMin,
            timeMax: range.timeMax,
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "250",
            fields:
              "items(id,status,summary,start,end,transparency,visibility,extendedProperties/private),nextPageToken",
            ...(pageToken ? { pageToken } : {}),
          },
        });
        const list = parse(eventListSchema, await response.json().catch(() => null));
        events.push(...list.items);
        pageToken = list.nextPageToken;
        if (!pageToken) break;
      }
      return events;
    },

    /** Insert with a client-chosen ID: a retry of the same insert returns `conflict`, never a duplicate. */
    async insertEvent(accessToken: string, calendarId: string, event: EventWrite): Promise<void> {
      await api(accessToken, `${calendarPath(calendarId)}/events`, {
        method: "POST",
        query: { fields: "id" },
        body: JSON.stringify(event),
      });
    },

    /** Full update; also restores an event that was deleted in Google (status "confirmed"). */
    async updateEvent(accessToken: string, calendarId: string, event: EventWrite): Promise<void> {
      await api(accessToken, `${calendarPath(calendarId)}/events/${encodeURIComponent(event.id)}`, {
        method: "PUT",
        query: { fields: "id" },
        body: JSON.stringify(event),
      });
    },

    /** Deleting an event that is already gone counts as success. */
    async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
      try {
        await api(
          accessToken,
          `${calendarPath(calendarId)}/events/${encodeURIComponent(eventId)}`,
          {
            method: "DELETE",
          },
        );
      } catch (error) {
        if (error instanceof GoogleApiError && error.kind === "not_found") return;
        throw error;
      }
    },
  };
}

export type GoogleClient = ReturnType<typeof googleClient>;
