import type { NextRequest } from "next/server";
import { cleanQuery, type SearchResponse } from "@/features/search/logic";
import { searchWorkspace } from "@/features/search/queries";
import { rateLimit } from "@/lib/rate-limit";
import { getWorkspaceContext } from "@/lib/workspace-context";

// Global search (REQUIREMENTS 9). Read-only, so GET. The proxy already requires a session for
// /api/* (except /api/health), getWorkspaceContext re-checks it, and RLS scopes every row. Results
// are personal: never cached. The query text is not logged.
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const query = cleanQuery(request.nextUrl.searchParams.get("q"));
  if (!query) {
    const empty: SearchResponse = { query: "", groups: [] };
    return Response.json(empty, { headers: PRIVATE });
  }

  const ctx = await getWorkspaceContext();

  // Debounced typing is a few requests per second at most; 120 a minute leaves plenty of room.
  const limit = await rateLimit(ctx.supabase, "search", ctx.user.id, 120, 60);
  if (!limit.allowed) {
    return Response.json(
      { error: "Searching too quickly. Try again in a moment." },
      { status: 429, headers: { ...PRIVATE, "Retry-After": String(limit.retryAfter) } },
    );
  }

  try {
    return Response.json(await searchWorkspace(ctx, query), { headers: PRIVATE });
  } catch {
    return Response.json(
      { error: "Search isn't available right now. Try again." },
      { status: 500, headers: PRIVATE },
    );
  }
}
