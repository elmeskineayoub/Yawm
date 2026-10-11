import { describe, expect, it } from "vitest";
import { classifyRoute, safeRedirectPath } from "@/lib/auth/routes";

describe("classifyRoute", () => {
  it.each([
    ["/login", "auth-page"],
    ["/sign-up", "auth-page"],
    ["/forgot-password", "auth-page"],
    ["/auth/callback", "public"],
    ["/auth/error", "public"],
    ["/api/health", "public"],
    ["/setup", "public"],
    ["/", "protected"],
    ["/dashboard", "protected"],
    ["/settings", "protected"],
    ["/reset-password", "protected"],
    // Prefix look-alikes must not inherit public access.
    ["/login-history", "protected"],
    ["/authors", "protected"],
    ["/api/healthcheck-admin", "protected"],
  ])("%s → %s", (path, expected) => {
    expect(classifyRoute(path)).toBe(expected);
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-origin relative paths with query and hash", () => {
    expect(safeRedirectPath("/settings?tab=account#theme")).toBe("/settings?tab=account#theme");
  });

  it.each([
    [null],
    [""],
    ["dashboard"],
    ["https://evil.example/phish"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["/\t/evil.example"],
    ["/\n/evil.example"],
    ["javascript:alert(1)"],
  ])("rejects %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });

  it("uses the provided fallback", () => {
    expect(safeRedirectPath("//x", "/login")).toBe("/login");
  });
});
