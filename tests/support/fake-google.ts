import { createHash, randomUUID } from "node:crypto";

/**
 * A stateful stand-in for the Google endpoints Yawm uses: OAuth authorize/token/revoke and the
 * Calendar API (calendar list, events list/insert/update/delete). It follows Google's documented
 * behavior where it matters for sync safety: client-chosen event IDs are unique per calendar
 * (inserting an existing ID returns 409, even after deletion), deleting twice returns 410,
 * a revoked refresh token returns `invalid_grant`, and rate limits return 403
 * `rateLimitExceeded`.
 *
 * `handle` is transport-free; `fetch` adapts it for unit/integration tests and
 * tests/e2e/mock-google.ts serves it over HTTP for browser tests.
 */

export const FAKE_CLIENT = { id: "fake-client-id", secret: "fake-client-secret" };

type StoredEvent = Record<string, unknown> & { id: string; status: string };
type Calendar = { id: string; summary: string; primary?: boolean; accessRole: string };

type Account = {
  email: string;
  calendars: Calendar[];
  events: Map<string, Map<string, StoredEvent>>;
};

type Failure = {
  method?: string;
  pathIncludes: string;
  status: number;
  reason?: string;
  times: number;
};

export type FakeResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

export class FakeGoogle {
  accounts = new Map<string, Account>();
  private codes = new Map<
    string,
    { email: string; challenge: string; redirectUri: string; scope: string; omitScope: boolean }
  >();
  private refreshTokens = new Map<string, string>();
  private accessTokens = new Map<string, { email: string; expiresAt: number }>();
  private failures: Failure[] = [];
  /** Every Calendar API write, for idempotency assertions. */
  calls: { method: string; path: string }[] = [];
  revoked: string[] = [];
  /**
   * How the next consent is answered: `scope` returns an explicit (possibly reduced) scope
   * string, as Google does when the user unticks a permission; `omitScope` leaves `scope` out
   * of the token response, which RFC 6749 allows when it equals the requested scope.
   */
  nextGrant: { scope?: string; omitScope?: boolean } | null = null;
  /** Next consent is declined (`error=access_denied`). */
  denyNext = false;
  private counter = 0;

  addAccount(email = `tester-${++this.counter}-${randomUUID().slice(0, 8)}@example.com`) {
    const account: Account = {
      email,
      calendars: [
        { id: email, summary: email, primary: true, accessRole: "owner" },
        {
          id: `work-${this.counter}@group.calendar.google.com`,
          summary: "Work",
          accessRole: "owner",
        },
        {
          id: "en.holidays#holiday@group.v.calendar.google.com",
          summary: "Holidays",
          accessRole: "reader",
        },
      ],
      events: new Map(),
    };
    for (const c of account.calendars) account.events.set(c.id, new Map());
    this.accounts.set(email, account);
    return account;
  }

  /** Issues tokens directly, as if the user had completed consent. */
  issueTokens(email: string, scope = REQUESTED_SCOPE) {
    const refresh = `rt-${randomUUID()}`;
    this.refreshTokens.set(refresh, email);
    const access = this.newAccessToken(email);
    return { refresh, access, scope };
  }

  addEvent(
    email: string,
    calendarId: string,
    event: { id: string; status?: string } & Record<string, unknown>,
  ) {
    this.account(email)
      .events.get(calendarId)!
      .set(event.id, { ...event, status: event.status ?? "confirmed" });
  }

  events(email: string, calendarId = email): StoredEvent[] {
    return [...(this.account(email).events.get(calendarId)?.values() ?? [])];
  }

  liveEvents(email: string, calendarId = email) {
    return this.events(email, calendarId).filter((e) => e.status !== "cancelled");
  }

  /** The user revokes access in their Google Account settings. */
  revokeAll(email: string) {
    for (const [token, owner] of this.refreshTokens)
      if (owner === email) this.refreshTokens.delete(token);
    for (const [token, info] of this.accessTokens)
      if (info.email === email) this.accessTokens.delete(token);
  }

  /** Expires every access token, forcing a refresh on the next call. */
  expireAccessTokens() {
    for (const info of this.accessTokens.values()) info.expiresAt = 0;
  }

  failNext(failure: Omit<Failure, "times"> & { times?: number }) {
    this.failures.push({ times: 1, ...failure });
  }

  writeCount(method?: string) {
    return this.calls.filter((c) => (method ? c.method === method : c.method !== "GET")).length;
  }

  private account(email: string) {
    const account = this.accounts.get(email);
    if (!account) throw new Error(`No fake account ${email}`);
    return account;
  }

  private newAccessToken(email: string) {
    const token = `at-${randomUUID()}`;
    this.accessTokens.set(token, { email, expiresAt: Date.now() + 3600_000 });
    return token;
  }

  private injected(method: string, path: string): FakeResponse | null {
    const index = this.failures.findIndex(
      (f) => (!f.method || f.method === method) && path.includes(f.pathIncludes),
    );
    if (index < 0) return null;
    const failure = this.failures[index]!;
    if (--failure.times <= 0) this.failures.splice(index, 1);
    return {
      status: failure.status,
      headers: failure.status === 429 ? { "retry-after": "30" } : {},
      body: {
        error: {
          code: failure.status,
          message: "Injected failure",
          errors: [{ reason: failure.reason ?? "backendError" }],
        },
      },
    };
  }

  handle(method: string, rawUrl: string, headers: Headers, body: string): FakeResponse {
    const url = new URL(rawUrl, "http://fake.google");
    const path = url.pathname;
    const injected = this.injected(method, path);
    if (injected) return injected;

    if (path === "/o/oauth2/v2/auth") return this.authorize(url);
    if (path === "/token" && method === "POST") return this.token(new URLSearchParams(body));
    if (path === "/revoke" && method === "POST") return this.revoke(new URLSearchParams(body));
    if (path.startsWith("/calendar/v3/")) return this.calendarApi(method, url, headers, body);
    return { status: 404, body: { error: "not_found" } };
  }

  private authorize(url: URL): FakeResponse {
    const p = url.searchParams;
    const redirect = new URL(p.get("redirect_uri") ?? "");
    redirect.searchParams.set("state", p.get("state") ?? "");
    if (this.denyNext) {
      this.denyNext = false;
      redirect.searchParams.set("error", "access_denied");
      return { status: 302, headers: { location: redirect.toString() } };
    }
    if (p.get("client_id") !== FAKE_CLIENT.id || p.get("code_challenge_method") !== "S256") {
      return { status: 400, body: "invalid_request" };
    }
    const account = this.addAccount();
    const code = `code-${randomUUID()}`;
    this.codes.set(code, {
      email: account.email,
      challenge: p.get("code_challenge") ?? "",
      redirectUri: p.get("redirect_uri") ?? "",
      scope: this.nextGrant?.scope ?? p.get("scope") ?? "",
      omitScope: this.nextGrant?.omitScope === true,
    });
    this.nextGrant = null;
    redirect.searchParams.set("code", code);
    return { status: 302, headers: { location: redirect.toString() } };
  }

  private token(p: URLSearchParams): FakeResponse {
    if (p.get("client_id") !== FAKE_CLIENT.id || p.get("client_secret") !== FAKE_CLIENT.secret) {
      return { status: 401, body: { error: "invalid_client" } };
    }
    if (p.get("grant_type") === "authorization_code") {
      const grant = this.codes.get(p.get("code") ?? "");
      this.codes.delete(p.get("code") ?? "");
      const challenge = createHash("sha256")
        .update(p.get("code_verifier") ?? "")
        .digest("base64url");
      if (!grant || grant.redirectUri !== p.get("redirect_uri") || grant.challenge !== challenge) {
        return { status: 400, body: { error: "invalid_grant" } };
      }
      const tokens = this.issueTokens(grant.email, grant.scope);
      return {
        status: 200,
        body: {
          access_token: tokens.access,
          refresh_token: tokens.refresh,
          expires_in: 3599,
          ...(grant.omitScope ? {} : { scope: grant.scope }),
          token_type: "Bearer",
        },
      };
    }
    if (p.get("grant_type") === "refresh_token") {
      const email = this.refreshTokens.get(p.get("refresh_token") ?? "");
      if (!email) return { status: 400, body: { error: "invalid_grant" } };
      return {
        status: 200,
        body: {
          access_token: this.newAccessToken(email),
          expires_in: 3599,
          scope: REQUESTED_SCOPE,
          token_type: "Bearer",
        },
      };
    }
    return { status: 400, body: { error: "unsupported_grant_type" } };
  }

  private revoke(p: URLSearchParams): FakeResponse {
    const token = p.get("token") ?? "";
    const email = this.refreshTokens.get(token) ?? this.accessTokens.get(token)?.email;
    if (!email) return { status: 400, body: { error: "invalid_token" } };
    this.revoked.push(email);
    this.revokeAll(email);
    return { status: 200, body: {} };
  }

  private calendarApi(method: string, url: URL, headers: Headers, body: string): FakeResponse {
    const token = headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const session = this.accessTokens.get(token);
    if (!session || session.expiresAt < Date.now()) {
      return { status: 401, body: { error: { code: 401, errors: [{ reason: "authError" }] } } };
    }
    const account = this.account(session.email);
    const path = url.pathname.replace("/calendar/v3", "");
    if (method !== "GET") this.calls.push({ method, path });

    if (path === "/users/me/calendarList" && method === "GET") {
      return { status: 200, body: { items: account.calendars } };
    }
    const match = path.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
    if (!match)
      return { status: 404, body: { error: { code: 404, errors: [{ reason: "notFound" }] } } };
    const calendarId = decodeURIComponent(match[1]!);
    const eventId = match[2] ? decodeURIComponent(match[2]) : null;
    const calendar = account.calendars.find((c) => c.id === calendarId);
    const events = account.events.get(calendarId);
    if (!calendar || !events) {
      return { status: 404, body: { error: { code: 404, errors: [{ reason: "notFound" }] } } };
    }
    const forbidden = {
      status: 403,
      body: { error: { code: 403, errors: [{ reason: "forbidden" }] } },
    };
    const notFound = {
      status: 404,
      body: { error: { code: 404, errors: [{ reason: "notFound" }] } },
    };

    if (method === "GET" && !eventId) {
      const min = Date.parse(url.searchParams.get("timeMin") ?? "");
      const max = Date.parse(url.searchParams.get("timeMax") ?? "");
      const items = [...events.values()].filter((e) => {
        if (e.status === "cancelled") return false;
        const start = e.start as { dateTime?: string; date?: string };
        const end = e.end as { dateTime?: string; date?: string };
        const s = Date.parse(start.dateTime ?? `${start.date}T00:00:00Z`);
        const en = Date.parse(end.dateTime ?? `${end.date}T00:00:00Z`);
        return s < max && en > min;
      });
      return { status: 200, body: { items } };
    }
    if (calendar.accessRole !== "owner") return forbidden;
    const payload = body ? (JSON.parse(body) as StoredEvent) : null;

    if (method === "POST" && !eventId) {
      if (!payload || !/^[a-v0-9]{5,1024}$/.test(payload.id)) {
        return { status: 400, body: { error: { code: 400, errors: [{ reason: "invalid" }] } } };
      }
      if (events.has(payload.id)) {
        return { status: 409, body: { error: { code: 409, errors: [{ reason: "duplicate" }] } } };
      }
      events.set(payload.id, { ...payload, status: "confirmed" });
      return { status: 200, body: { id: payload.id } };
    }
    if (!eventId) return notFound;
    const existing = events.get(eventId);
    if (method === "PUT") {
      if (!existing || !payload) return notFound;
      events.set(eventId, { ...payload, id: eventId, status: payload.status ?? existing.status });
      return { status: 200, body: { id: eventId } };
    }
    if (method === "DELETE") {
      if (!existing) return notFound;
      if (existing.status === "cancelled") {
        return { status: 410, body: { error: { code: 410, errors: [{ reason: "deleted" }] } } };
      }
      existing.status = "cancelled";
      return { status: 204 };
    }
    return notFound;
  }

  /** A `fetch` that routes every request to this fake. */
  fetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const method = (init.method ?? "GET").toUpperCase();
    const response = this.handle(
      method,
      input,
      new Headers(init.headers),
      typeof init.body === "string" ? init.body : "",
    );
    const text =
      response.body === undefined
        ? null
        : typeof response.body === "string"
          ? response.body
          : JSON.stringify(response.body);
    return new Response(response.status === 204 ? null : text, {
      status: response.status,
      headers: { "content-type": "application/json", ...response.headers },
    });
  };
}

export const REQUESTED_SCOPE = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.owned",
].join(" ");

export function fakeGoogleConfig(origin = "http://127.0.0.1:4010") {
  const key = Buffer.alloc(32, 7).toString("base64");
  return {
    GOOGLE_CALENDAR_INTEGRATION_ENABLED: "true",
    GOOGLE_CLIENT_ID: FAKE_CLIENT.id,
    GOOGLE_CLIENT_SECRET: FAKE_CLIENT.secret,
    GOOGLE_REDIRECT_URI: "http://localhost:3000/api/integrations/google-calendar/callback",
    GOOGLE_TOKEN_ENCRYPTION_KEY: key,
    GOOGLE_API_ORIGIN_OVERRIDE: origin,
  };
}
