import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { classifyRoute, DEFAULT_SIGNED_IN_PATH, LOGIN_PATH, SETUP_PATH } from "@/lib/auth/routes";
import { getSupabasePublicConfig } from "@/lib/env";

/** Refreshes the Supabase session cookie and enforces signed-in/signed-out routing. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const config = getSupabasePublicConfig();
  // Without configuration nothing can be loaded or saved: send every page to the setup guide.
  if (!config.configured) {
    const { pathname } = request.nextUrl;
    if (pathname === SETUP_PATH || pathname === "/api/health") return response;
    const url = request.nextUrl.clone();
    url.pathname = SETUP_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Responses that set auth cookies must never be cached and shared between users.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): getClaims() validates the JWT
  // and triggers the refresh that keeps sessions alive.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const access = classifyRoute(request.nextUrl.pathname);
  if (access === "protected" && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    if (next !== "/") url.searchParams.set("next", next);
    return redirectWithCookies(url, response);
  }
  if (access === "auth-page" && signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_SIGNED_IN_PATH;
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  from.headers.forEach((value, key) => {
    if (["cache-control", "expires", "pragma"].includes(key)) redirect.headers.set(key, value);
  });
  return redirect;
}
