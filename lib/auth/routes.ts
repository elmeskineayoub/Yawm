export const DEFAULT_SIGNED_IN_PATH = "/dashboard";
export const LOGIN_PATH = "/login";
export const SETUP_PATH = "/setup";

/** Pages for signed-out users; signed-in users are sent to the app instead. */
const AUTH_PAGES = ["/login", "/sign-up", "/forgot-password"];
/** Reachable with or without a session. */
const PUBLIC_PREFIXES = ["/auth/", "/api/health", "/setup"];

export type RouteAccess = "auth-page" | "public" | "protected";

function matches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path.endsWith("/") ? path : `${path}/`);
}

export function classifyRoute(pathname: string): RouteAccess {
  if (AUTH_PAGES.some((path) => matches(pathname, path))) return "auth-page";
  if (PUBLIC_PREFIXES.some((path) => matches(pathname, path))) return "public";
  return "protected";
}

/**
 * Returns a same-origin relative path for post-auth redirects, or the fallback. Rejects absolute
 * URLs, protocol-relative URLs (`//evil.example`), and backslash tricks to prevent open redirects.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  // Control characters (including tab/newline) can be stripped by browsers into `//`.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  const base = "http://internal.invalid";
  try {
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
