import { describe, expect, it } from "vitest";
import { getSupabasePublicConfig } from "@/lib/env";

describe("getSupabasePublicConfig", () => {
  it("reports both values missing when unset", () => {
    const result = getSupabasePublicConfig({});
    expect(result.configured).toBe(false);
    if (!result.configured) expect(result.problems).toHaveLength(2);
  });

  it("treats .env.example placeholders as unconfigured", () => {
    const result = getSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_REPLACE_ME",
    });
    expect(result.configured).toBe(false);
  });

  it("rejects non-https remote URLs", () => {
    const result = getSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "http://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
    });
    expect(result.configured).toBe(false);
  });

  it("accepts a local http Supabase stack", () => {
    const result = getSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
    });
    expect(result.configured).toBe(true);
  });

  it("returns trimmed values when configured", () => {
    const result = getSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: " https://abc.supabase.co ",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc\n",
    });
    expect(result).toEqual({
      configured: true,
      url: "https://abc.supabase.co",
      publishableKey: "sb_publishable_abc",
    });
  });
});
