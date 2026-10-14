import "server-only";
import { headers } from "next/headers";
import type { Db } from "@/lib/db/types";
import { getSupabasePublicConfig } from "@/lib/env";

/**
 * App-level rate limiting is a production concern. Against a local Supabase stack (dev, CI, e2e)
 * every request shares one loopback IP, which would false-positive, so it is skipped there. Hosted
 * (https) deployments always enforce it; Supabase Auth also rate-limits auth endpoints regardless.
 */
function limiterActive(): boolean {
  const config = getSupabasePublicConfig();
  if (!config.configured) return false;
  try {
    const host = new URL(config.url).hostname;
    return host !== "localhost" && host !== "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Application-level rate limiting backed by a durable Postgres counter (see
 * supabase/migrations/20261020090000_rate_limits.sql). Fails open: if the limiter itself errors we
 * allow the request rather than lock users out — Supabase Auth still rate-limits auth endpoints as
 * defence in depth.
 */

export type RateBucket = "auth:signin" | "auth:signup" | "auth:reset" | "export" | "google:sync";

export type RateLimitResult = { allowed: boolean; retryAfter: number };

export async function rateLimit(
  db: Db,
  bucket: RateBucket,
  identifier: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!limiterActive()) return { allowed: true, retryAfter: 0 };
  const { data, error } = await db.rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_identifier: identifier || "unknown",
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error || !data || typeof data !== "object") return { allowed: true, retryAfter: 0 };
  const result = data as { allowed?: boolean; retry_after?: number };
  return { allowed: result.allowed !== false, retryAfter: result.retry_after ?? 0 };
}

/** Best-effort client IP from the proxy headers, for rate-limiting unauthenticated endpoints. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}
