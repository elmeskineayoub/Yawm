import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createConfirmedUser, deleteUsers, publicClient, type TestUser } from "./helpers";

let alice: TestUser;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-rl");
});

afterAll(async () => {
  await deleteUsers(alice);
});

type Hit = { allowed: boolean; retry_after: number };

async function hit(bucket: string, id: string, max: number, windowSeconds = 3600) {
  const { data, error } = await alice.client.rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_identifier: id,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data as unknown as Hit;
}

describe("rate_limit_hit", () => {
  it("allows up to max, then blocks with a retry_after", async () => {
    const id = randomUUID();
    expect((await hit("export", id, 3)).allowed).toBe(true);
    expect((await hit("export", id, 3)).allowed).toBe(true);
    expect((await hit("export", id, 3)).allowed).toBe(true);
    const blocked = await hit("export", id, 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retry_after).toBeGreaterThan(0);
  });

  it("counts identifiers independently", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await hit("export", a, 1);
    expect((await hit("export", a, 1)).allowed).toBe(false);
    // A different identifier is unaffected.
    expect((await hit("export", b, 1)).allowed).toBe(true);
  });

  it("rejects unknown buckets", async () => {
    const { error } = await alice.client.rpc("rate_limit_hit", {
      p_bucket: "arbitrary",
      p_identifier: "x",
      p_max: 5,
      p_window_seconds: 60,
    });
    expect(error?.message).toContain("UNKNOWN_RATE_LIMIT_BUCKET");
  });

  it("is not reachable by anonymous callers only via the function (table is private)", async () => {
    // The counter table lives in the private schema; PostgREST cannot see it.
    const anon = publicClient();
    const { error } = await anon.from("rate_limits" as never).select("*");
    expect(error).not.toBeNull();
  });
});
