import type { NextRequest } from "next/server";
import { tasksToCsv } from "@/features/backups/csv";
import { buildExportBundle } from "@/features/backups/export";
import { journalToMarkdown } from "@/features/backups/markdown";
import { getWorkspaceContext } from "@/lib/workspace-context";

// A signed-in user downloads their own workspace. The proxy already requires a session for /api/*
// (except /api/health); RLS scopes every row to this user. Never cache a personal export.
export const dynamic = "force-dynamic";

const FORMATS = ["json", "tasks-csv", "journal-md"] as const;
type Format = (typeof FORMATS)[number];

function isFormat(value: string | null): value is Format {
  return value !== null && (FORMATS as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("format");
  const format: Format = isFormat(requested) ? requested : "json";

  const ctx = await getWorkspaceContext();
  const bundle = await buildExportBundle(ctx);
  const stamp = ctx.today;

  const file =
    format === "tasks-csv"
      ? {
          body: tasksToCsv(bundle.records),
          type: "text/csv; charset=utf-8",
          name: `yawm-tasks-${stamp}.csv`,
        }
      : format === "journal-md"
        ? {
            body: journalToMarkdown(bundle.records),
            type: "text/markdown; charset=utf-8",
            name: `yawm-journal-${stamp}.md`,
          }
        : {
            body: JSON.stringify(bundle, null, 2),
            type: "application/json; charset=utf-8",
            name: `yawm-backup-${stamp}.json`,
          };

  return new Response(file.body, {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "Cache-Control": "no-store",
    },
  });
}
