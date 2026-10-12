// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import {
  GoogleApiError,
  googleClient,
  grantedScopes,
  missingScopes,
} from "@/features/google-calendar/client";
import { getGoogleConfig, GOOGLE_SCOPES } from "@/features/google-calendar/config";
import { decryptSecret, encryptSecret } from "@/features/google-calendar/crypto";
import {
  blockSyncStates,
  eventForBlock,
  eventIdForBlock,
  planSync,
  toExternalEvents,
} from "@/features/google-calendar/events";
import { createOAuthState, verifyOAuthState } from "@/features/google-calendar/oauth-state";
import { FakeGoogle, fakeGoogleConfig } from "../support/fake-google";

function enabledConfig() {
  const result = getGoogleConfig(fakeGoogleConfig());
  if (!result.enabled) throw new Error(result.problems.join(" "));
  return result.config;
}

describe("feature flag", () => {
  it("is off unless explicitly enabled", () => {
    expect(getGoogleConfig({})).toEqual({ enabled: false, reason: "disabled", problems: [] });
    expect(
      getGoogleConfig({ ...fakeGoogleConfig(), GOOGLE_CALENDAR_INTEGRATION_ENABLED: "false" }),
    ).toMatchObject({ enabled: false, reason: "disabled" });
  });

  it("stays off and explains why when credentials are incomplete", () => {
    const result = getGoogleConfig({
      GOOGLE_CALENDAR_INTEGRATION_ENABLED: "true",
      GOOGLE_REDIRECT_URI: "http://evil.example/callback",
      GOOGLE_TOKEN_ENCRYPTION_KEY: "short",
    });
    expect(result.enabled).toBe(false);
    if (!result.enabled) {
      expect(result.reason).toBe("misconfigured");
      expect(result.problems.join(" ")).toMatch(/GOOGLE_CLIENT_ID/);
      expect(result.problems.join(" ")).toMatch(/GOOGLE_CLIENT_SECRET/);
      expect(result.problems.join(" ")).toMatch(/GOOGLE_REDIRECT_URI/);
      expect(result.problems.join(" ")).toMatch(/GOOGLE_TOKEN_ENCRYPTION_KEY/);
      // Problems name variables, never their values.
      expect(result.problems.join(" ")).not.toContain("short");
    }
  });

  it("only lets tests redirect Google traffic to a loopback origin", () => {
    const remote = getGoogleConfig({
      ...fakeGoogleConfig(),
      GOOGLE_API_ORIGIN_OVERRIDE: "https://attacker.example",
    });
    expect(remote.enabled).toBe(false);
    const real = getGoogleConfig({ ...fakeGoogleConfig(), GOOGLE_API_ORIGIN_OVERRIDE: "" });
    expect(real.enabled && real.config.endpoints.token).toBe("https://oauth2.googleapis.com/token");
  });

  it("derives separate keys for tokens and OAuth state", () => {
    const config = enabledConfig();
    expect(config.tokenKey.equals(config.stateKey)).toBe(false);
    expect(config.tokenKey).toHaveLength(32);
  });
});

describe("token encryption", () => {
  const key = Buffer.alloc(32, 1);

  it("round-trips and never stores the plaintext", () => {
    const sealed = encryptSecret("refresh-token-value", key, "ctx");
    expect(sealed).not.toContain("refresh-token-value");
    expect(decryptSecret(sealed, key, "ctx")).toBe("refresh-token-value");
    // A fresh IV each time.
    expect(encryptSecret("refresh-token-value", key, "ctx")).not.toBe(sealed);
  });

  it("rejects another key, another row's context, and tampering", () => {
    const sealed = encryptSecret("secret", key, "google-refresh-token:ws1:user1");
    expect(decryptSecret(sealed, Buffer.alloc(32, 2), "google-refresh-token:ws1:user1")).toBeNull();
    expect(decryptSecret(sealed, key, "google-refresh-token:ws2:user1")).toBeNull();
    const parts = sealed.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(decryptSecret(parts.join("."), key, "google-refresh-token:ws1:user1")).toBeNull();
    expect(decryptSecret("garbage", key, "ctx")).toBeNull();
  });
});

describe("OAuth state", () => {
  const key = Buffer.alloc(32, 3);
  const owner = { userId: "u1", workspaceId: "w1" };

  it("accepts the same state, user, and workspace within ten minutes", () => {
    const { state, cookieValue } = createOAuthState(owner, key, 1_000);
    const check = verifyOAuthState(cookieValue, state, owner, key, 1_000 + 9 * 60_000);
    expect(check.ok).toBe(true);
  });

  it("rejects a missing cookie, a different state, another user, expiry, and tampering", () => {
    const { state, cookieValue } = createOAuthState(owner, key, 1_000);
    expect(verifyOAuthState(undefined, state, owner, key, 1_000)).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(verifyOAuthState(cookieValue, `${state}x`, owner, key, 1_000)).toMatchObject({
      reason: "mismatch",
    });
    expect(
      verifyOAuthState(cookieValue, state, { ...owner, userId: "u2" }, key, 1_000),
    ).toMatchObject({ reason: "mismatch" });
    expect(
      verifyOAuthState(cookieValue, state, { ...owner, workspaceId: "w2" }, key, 1_000),
    ).toMatchObject({ reason: "mismatch" });
    expect(verifyOAuthState(cookieValue, state, owner, key, 1_000 + 11 * 60_000)).toMatchObject({
      reason: "expired",
    });
    expect(verifyOAuthState(`${cookieValue}x`, state, owner, key, 1_000)).toMatchObject({
      reason: "invalid",
    });
    expect(verifyOAuthState(cookieValue, state, owner, Buffer.alloc(32, 4), 1_000)).toMatchObject({
      reason: "invalid",
    });
  });
});

const block = {
  id: "0b6f3c1e-2d4a-4b8c-9e1f-a2b3c4d5e6f7",
  title: "Deep work",
  starts_at: "2026-10-14T09:00:00+00:00",
  ends_at: "2026-10-14T10:30:00+00:00",
  timezone: "Asia/Tokyo",
  updated_at: "2026-10-12T08:00:00+00:00",
};

describe("event mapping", () => {
  it("uses a fixed, Google-valid event ID per block", () => {
    const id = eventIdForBlock(block.id);
    expect(id).toBe("0b6f3c1e2d4a4b8c9e1fa2b3c4d5e6f7");
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(() => eventIdForBlock("not-a-uuid")).toThrow();
  });

  it("sends only the title, times, and a private back-reference", () => {
    const event = eventForBlock({ ...block, notes: "private notes" } as typeof block);
    expect(event).toEqual({
      id: "0b6f3c1e2d4a4b8c9e1fa2b3c4d5e6f7",
      summary: "Deep work",
      start: { dateTime: "2026-10-14T09:00:00.000Z", timeZone: "Asia/Tokyo" },
      end: { dateTime: "2026-10-14T10:30:00.000Z", timeZone: "Asia/Tokyo" },
      status: "confirmed",
      transparency: "opaque",
      extendedProperties: { private: { yawmBlockId: block.id } },
    });
    expect(JSON.stringify(event)).not.toContain("private notes");
  });

  it("shows Google events read-only, hiding Yawm's own copies and private details", () => {
    const events = toExternalEvents(
      [
        {
          id: "a",
          summary: "Dentist",
          start: { dateTime: "2026-10-14T15:00:00+09:00" },
          end: { dateTime: "2026-10-14T16:00:00+09:00" },
        },
        {
          id: "b",
          summary: "Secret",
          visibility: "private",
          start: { dateTime: "2026-10-14T17:00:00Z" },
          end: { dateTime: "2026-10-14T18:00:00Z" },
        },
        {
          id: "c",
          status: "cancelled",
          start: { date: "2026-10-14" },
          end: { date: "2026-10-15" },
        },
        {
          id: "d",
          summary: "Ours",
          extendedProperties: { private: { yawmBlockId: block.id } },
          start: { dateTime: "2026-10-14T09:00:00Z" },
          end: { dateTime: "2026-10-14T10:00:00Z" },
        },
        {
          id: "e",
          summary: "Holiday",
          transparency: "transparent",
          start: { date: "2026-10-14" },
          end: { date: "2026-10-15" },
        },
        { id: "f", summary: "Broken", start: { dateTime: "x" }, end: { dateTime: "y" } },
      ],
      "Personal",
    );
    expect(events).toEqual([
      {
        id: "a",
        title: "Dentist",
        calendarName: "Personal",
        start: "2026-10-14T06:00:00.000Z",
        end: "2026-10-14T07:00:00.000Z",
        allDay: false,
        free: false,
      },
      expect.objectContaining({ id: "b", title: "Busy" }),
      expect.objectContaining({ id: "e", allDay: true, free: true, start: "2026-10-14" }),
    ]);
  });
});

describe("sync planning", () => {
  const synced = {
    id: "row-1",
    time_block_id: block.id,
    calendar_id: "primary@example.com",
    event_id: eventIdForBlock(block.id),
    status: "synced" as const,
    block_updated_at: block.updated_at,
  };

  it("does nothing when every block is up to date", () => {
    expect(planSync([{ ...synced, block }], [block], "primary@example.com")).toEqual([]);
  });

  it("creates unseen blocks, updates changed ones, and deletes removed ones", () => {
    const fresh = { ...block, id: "11111111-2222-4333-8444-555555555555" };
    const changed = { ...block, updated_at: "2026-10-12T09:00:00+00:00" };
    const ops = planSync(
      [
        { ...synced, block: changed },
        { ...synced, id: "row-2", time_block_id: null, event_id: "deadbeef", block: null },
      ],
      [changed, fresh],
      "primary@example.com",
    );
    expect(ops.map((o) => o.kind)).toEqual(["delete", "update", "create"]);
  });

  it("re-pushes failed rows and rows on a previous target calendar", () => {
    expect(
      planSync([{ ...synced, status: "error", block }], [], "primary@example.com"),
    ).toHaveLength(1);
    expect(planSync([{ ...synced, block }], [], "work@example.com")).toHaveLength(1);
  });

  it("reports per-block state", () => {
    const states = blockSyncStates(
      [{ ...synced, status: "error" }],
      planSync([{ ...synced, status: "error", block }], [], "primary@example.com"),
    );
    expect(states.get(block.id)).toBe("error");
  });
});

describe("Google client against simulated responses", () => {
  function setup() {
    const fake = new FakeGoogle();
    const client = googleClient(enabledConfig(), fake.fetch);
    const account = fake.addAccount();
    const { access, refresh } = fake.issueTokens(account.email);
    return { fake, client, account, access, refresh };
  }

  it("builds an authorize URL with the narrow scopes, offline access, state, and PKCE", () => {
    const url = new URL(
      googleClient(enabledConfig()).authorizeUrl({ state: "s1", codeChallenge: "c1" }),
    );
    expect(url.origin).toBe("http://127.0.0.1:4010");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_SCOPES.join(" "));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("refuses a second insert with the same ID, so retries can't duplicate events", async () => {
    const { fake, client, account, access } = setup();
    const event = eventForBlock(block);
    await client.insertEvent(access, account.email, event);
    await expect(client.insertEvent(access, account.email, event)).rejects.toMatchObject({
      kind: "conflict",
    });
    expect(fake.liveEvents(account.email)).toHaveLength(1);
  });

  it("treats deleting an already-deleted or missing event as success", async () => {
    const { client, account, access } = setup();
    await client.insertEvent(access, account.email, eventForBlock(block));
    await client.deleteEvent(access, account.email, eventIdForBlock(block.id));
    await expect(
      client.deleteEvent(access, account.email, eventIdForBlock(block.id)),
    ).resolves.toBeUndefined();
    await expect(client.deleteEvent(access, account.email, "missing1")).resolves.toBeUndefined();
  });

  it("classifies revoked tokens, auth errors, quota errors, outages, and bad responses", async () => {
    const { fake, client, account, access, refresh } = setup();
    fake.revokeAll(account.email);
    await expect(client.refreshAccessToken(refresh)).rejects.toMatchObject({ kind: "revoked" });
    await expect(client.listCalendars(access)).rejects.toMatchObject({ kind: "unauthorized" });

    const second = setup();
    second.fake.failNext({ pathIncludes: "/events", status: 403, reason: "rateLimitExceeded" });
    await expect(
      second.client.listEvents(second.access, second.account.email, {
        timeMin: "2026-10-14T00:00:00Z",
        timeMax: "2026-10-15T00:00:00Z",
      }),
    ).rejects.toMatchObject({ kind: "rate_limited" });
    second.fake.failNext({ pathIncludes: "/calendarList", status: 429 });
    const limited = await second.client.listCalendars(second.access).catch((e: unknown) => e);
    expect(limited).toBeInstanceOf(GoogleApiError);
    expect(limited).toMatchObject({ kind: "rate_limited", retryAfterSeconds: 30 });
    second.fake.failNext({ pathIncludes: "/calendarList", status: 503 });
    await expect(second.client.listCalendars(second.access)).rejects.toMatchObject({
      kind: "unavailable",
    });

    const offline = googleClient(enabledConfig(), () =>
      Promise.reject(new TypeError("fetch failed")),
    );
    await expect(offline.listCalendars("x")).rejects.toMatchObject({ kind: "unavailable" });
    const garbled = googleClient(enabledConfig(), () =>
      Promise.resolve(new Response('{"items": 5}', { status: 200 })),
    );
    await expect(garbled.listCalendars("x")).rejects.toMatchObject({ kind: "invalid" });
  });

  it("never puts tokens in error messages", async () => {
    const { fake, client, access } = setup();
    fake.failNext({ pathIncludes: "/calendarList", status: 500 });
    const error = (await client.listCalendars(access).catch((e: unknown) => e)) as Error;
    expect(error.message).not.toContain(access);
  });
});

describe("granted scopes in the token response", () => {
  const [calendarList, eventsOwned] = GOOGLE_SCOPES;

  /** Runs consent and the code exchange against the fake, as the callback does. */
  async function exchange(grant: { scope?: string; omitScope?: boolean }) {
    const fake = new FakeGoogle();
    const config = enabledConfig();
    const client = googleClient(config, fake.fetch);
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    fake.nextGrant = grant;
    const consent = fake.handle(
      "GET",
      client.authorizeUrl({ state: "s", codeChallenge: challenge }),
      new Headers(),
      "",
    );
    const code = new URL(consent.headers!.location!).searchParams.get("code")!;
    return client.exchangeCode(code, verifier);
  }

  it("treats an omitted scope as exactly the requested scopes (RFC 6749 §5.1)", async () => {
    expect(grantedScopes(undefined, GOOGLE_SCOPES)).toEqual([...GOOGLE_SCOPES]);
    const grant = await exchange({ omitScope: true });
    expect(grant.scopes).toEqual([...GOOGLE_SCOPES]);
    expect(missingScopes(grant.scopes)).toEqual([]);
  });

  it("still rejects an explicitly reduced scope, e.g. a permission unticked at consent", async () => {
    const grant = await exchange({ scope: calendarList });
    expect(grant.scopes).toEqual([calendarList]);
    expect(missingScopes(grant.scopes)).toEqual([eventsOwned]);
  });

  it("treats an explicit empty or unrelated scope as nothing granted", async () => {
    expect(missingScopes((await exchange({ scope: "" })).scopes)).toEqual([...GOOGLE_SCOPES]);
    expect(missingScopes((await exchange({ scope: "openid email" })).scopes)).toEqual([
      ...GOOGLE_SCOPES,
    ]);
  });

  it("accepts the full set in any order, with extra whitespace or extra scopes", async () => {
    expect(grantedScopes(`  ${eventsOwned}\t${calendarList}  `, GOOGLE_SCOPES)).toEqual([
      eventsOwned,
      calendarList,
    ]);
    const grant = await exchange({ scope: `openid ${eventsOwned} ${calendarList}` });
    expect(missingScopes(grant.scopes)).toEqual([]);
  });
});
