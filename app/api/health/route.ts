// Non-sensitive readiness probe: reports only that the app process is serving requests.
// It intentionally exposes no configuration, versions, or database details.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
