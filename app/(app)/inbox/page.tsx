import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { CaptureIdeaForm } from "@/components/inbox/capture-idea-form";
import { IdeaActions } from "@/components/inbox/idea-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/field";
import { loadIdeas } from "@/features/inbox/queries";
import { IDEA_STATUS_LABELS, ideaStatus, type IdeaStatus } from "@/features/inbox/schemas";
import { dateOfInstant, formatDate } from "@/lib/dates";
import { normalizeQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Inbox" };

const TABS: (IdeaStatus | "all")[] = ["inbox", "developing", "someday", "archived", "all"];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status: IdeaStatus | "all" =
    rawStatus === "all" ? "all" : (ideaStatus.safeParse(rawStatus).data ?? "inbox");
  const q = normalizeQuery(params.q);
  const rawTag = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const tagId = z.uuid().safeParse(rawTag).success ? (rawTag as string) : null;

  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Number.parseInt(rawPage ?? "1", 10);

  const ctx = await getWorkspaceContext();
  const [result, tags] = await Promise.all([
    loadIdeas(
      ctx,
      { status, q, tagId },
      { page: Number.isFinite(requestedPage) ? requestedPage : 1 },
    ),
    ctx.supabase.from("tags").select("id, name").eq("workspace_id", ctx.workspace.id).order("name"),
  ]);

  const { ideas, total, page, pageCount, pageSize } = result;

  /** Keeps search and tag filters; a new status or filter starts again at page 1. */
  const inboxHref = (tab: IdeaStatus | "all", targetPage = 1) => {
    const search = new URLSearchParams();
    if (tab !== "inbox") search.set("status", tab);
    if (q) search.set("q", q);
    if (tagId) search.set("tag", tagId);
    if (targetPage > 1) search.set("page", String(targetPage));
    const s = search.toString();
    return s ? `/inbox?${s}` : "/inbox";
  };
  const firstShown = (page - 1) * pageSize + 1;
  const lastShown = firstShown + ideas.length - 1;

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Capture first, sort later. Turn ideas into tasks or projects when they're ready."
      />
      <div className="space-y-4">
        <CaptureIdeaForm />

        <nav aria-label="Idea status" className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Link
              key={tab}
              href={inboxHref(tab)}
              aria-current={status === tab ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                status === tab
                  ? "border-accent font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "all" ? "All" : IDEA_STATUS_LABELS[tab]}
            </Link>
          ))}
        </nav>

        <form method="get" role="search" aria-label="Search ideas" className="flex flex-wrap gap-2">
          {status !== "inbox" && <input type="hidden" name="status" value={status} />}
          <label htmlFor="idea-search" className="sr-only">
            Search ideas
          </label>
          <input
            id="idea-search"
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search ideas"
            className={cn(controlClass, "min-w-0 flex-1 basis-48 py-1.5")}
          />
          {(tags.data ?? []).length > 0 && (
            <>
              <label htmlFor="idea-tag" className="sr-only">
                Tag
              </label>
              <select
                id="idea-tag"
                name="tag"
                defaultValue={tagId ?? ""}
                className={cn(controlClass, "w-auto py-1.5")}
              >
                <option value="">Any tag</option>
                {(tags.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <Button type="submit" variant="secondary" className="py-1.5">
            Search
          </Button>
        </form>

        {ideas.length === 0 ? (
          <EmptyState title={q || tagId ? "No matching ideas" : "Nothing here"}>
            {status === "inbox" && !q && !tagId
              ? "Your inbox is clear. Capture anything above."
              : "Try another status or search."}
          </EmptyState>
        ) : (
          <>
            <ul
              aria-label="Ideas"
              className="divide-y divide-border rounded-lg border border-border"
            >
              {ideas.map((idea) => (
                <li key={idea.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/inbox/${idea.id}`}
                      className="text-sm font-medium break-words hover:underline"
                    >
                      {idea.title}
                    </Link>
                    {idea.body && (
                      <p className="mt-0.5 line-clamp-2 text-sm break-words text-muted-foreground">
                        {idea.body}
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatDate(dateOfInstant(idea.created_at, ctx.timezone), "short")}
                      </span>
                      {status === "all" && <span>{IDEA_STATUS_LABELS[idea.status]}</span>}
                      {idea.tags.map((t) => (
                        <span key={t.id}>#{t.name}</span>
                      ))}
                    </p>
                  </div>
                  <IdeaActions idea={idea} />
                </li>
              ))}
            </ul>
            <nav
              aria-label="Idea pages"
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <p role="status" className="text-muted-foreground">
                {total <= pageSize
                  ? `${total} idea${total === 1 ? "" : "s"}`
                  : `Showing ${firstShown}–${lastShown} of ${total} ideas`}
              </p>
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={inboxHref(status, page - 1)}
                      rel="prev"
                      className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-muted"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="rounded-md border border-border px-3 py-1.5 opacity-50"
                    >
                      Previous
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    Page {page} of {pageCount}
                  </span>
                  {page < pageCount ? (
                    <Link
                      href={inboxHref(status, page + 1)}
                      rel="next"
                      className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-muted"
                    >
                      Next
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="rounded-md border border-border px-3 py-1.5 opacity-50"
                    >
                      Next
                    </span>
                  )}
                </div>
              )}
            </nav>
          </>
        )}
      </div>
    </>
  );
}
