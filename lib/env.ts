/**
 * Public (browser-safe) configuration checks. Only NEXT_PUBLIC_* values belong here.
 * Server-only secrets must never be read from this module.
 */

export type SupabasePublicConfig =
  | { configured: true; url: string; publishableKey: string }
  | { configured: false; problems: string[] };

type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string | undefined;
};

const PLACEHOLDER_MARKERS = ["YOUR_PROJECT_REF", "REPLACE_ME"];

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_MARKERS.some((marker) => value.includes(marker));
}

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    // Plain HTTP is only acceptable for a local Supabase stack.
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

// NEXT_PUBLIC_* variables must be referenced literally so Next.js can inline them.
const defaultEnv: PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

export function getSupabasePublicConfig(env: PublicEnv = defaultEnv): SupabasePublicConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const problems: string[] = [];

  if (!url || isPlaceholder(url)) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL is not set.");
  } else if (!isValidSupabaseUrl(url)) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL must be an https:// URL (http:// only for localhost).");
  }

  if (!publishableKey || isPlaceholder(publishableKey)) {
    problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.");
  }

  if (problems.length > 0) return { configured: false, problems };
  return { configured: true, url, publishableKey };
}

/** Canonical public origin used in auth email links, e.g. `https://yawm.example.com`. */
export function getAppUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
