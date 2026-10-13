import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { securityHeaders } from "@/lib/security-headers";

describe("security headers", () => {
  it("sets conservative, origin-independent defaults on every route", () => {
    const byKey = new Map(securityHeaders.map((h) => [h.key, h.value]));
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(byKey.get("Strict-Transport-Security")).toContain("max-age=");
    expect(byKey.get("Permissions-Policy")).toContain("geolocation=()");
  });
});

describe("robots", () => {
  it("disallows indexing the private app", () => {
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });
});
