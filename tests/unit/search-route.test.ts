import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  searchWorkspace: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@/lib/workspace-context", () => ({ getWorkspaceContext: mocks.getWorkspaceContext }));
vi.mock("@/features/search/queries", () => ({ searchWorkspace: mocks.searchWorkspace }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

const { GET } = await import("@/app/api/search/route");
const request = (q: string | null) =>
  new NextRequest(`http://localhost/api/search${q === null ? "" : `?q=${encodeURIComponent(q)}`}`);

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue({ user: { id: "u1" }, supabase: {} });
    mocks.rateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
    mocks.searchWorkspace.mockResolvedValue({ query: "plan", groups: [] });
  });

  it("returns an empty result for short or missing queries without touching the database", async () => {
    for (const q of [null, "", " a "]) {
      const res = await GET(request(q));
      expect(await res.json()).toEqual({ query: "", groups: [] });
    }
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
    expect(mocks.searchWorkspace).not.toHaveBeenCalled();
  });

  it("searches with the cleaned query, per user rate limit, and never caches", async () => {
    const res = await GET(request("  plan   week "));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rateLimit).toHaveBeenCalledWith({}, "search", "u1", 120, 60);
    expect(mocks.searchWorkspace).toHaveBeenCalledWith(expect.anything(), "plan week");
  });

  it("answers 429 with Retry-After when the user is searching too fast", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfter: 12 });
    const res = await GET(request("plan"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
    expect(mocks.searchWorkspace).not.toHaveBeenCalled();
  });

  it("hides internal errors behind a generic message", async () => {
    mocks.searchWorkspace.mockRejectedValue(new Error("relation does not exist: secret detail"));
    const res = await GET(request("plan"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("secret detail");
  });
});
