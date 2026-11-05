import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { CaptureIdeaForm } from "@/components/inbox/capture-idea-form";
import { IdeaActions } from "@/components/inbox/idea-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/link-tabs";
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
        description={
          status === "inbox" && !q && !tagId
            ? total === 0
              ? "Capture first, sort later."
              : `${total} idea${total === 1 ? "" : "s"} to sort. Convert, file for later, or archive.`
            : "Capture first, sort later. Turn ideas into tasks, projects, or goals when they're ready."
        }
      />
      <div className="max-w-3xl space-y-5">
        <CaptureIdeaForm />

        <LinkTabs
          label="Idea status"
          current={status}
          tabs={TABS.map((tab) => ({
            key: tab,
            href: inboxHref(tab),
            label: tab === "all" ? "All" : IDEA_STATUS_LABELS[tab],
          }))}
        />

        <form
          method="get"
          role="search"
          aria-label="Search ideas"
          className="flex flex-wrap items-center gap-2"
        >
          {status !== "inbox" && <input type="hidden" name="status" value={status} />}
          <label htmlFor="idea-search" className="sr-only">
            Search ideas
          </label>
          <div className="relative min-w-0 flex-1 basis-48 sm:max-w-72">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="idea-search"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search ideas"
              className={cn(controlClass, "h-8 rounded-full py-1 pl-8 text-[0.8125rem]")}
            />
          </div>
          {(tags.data ?? []).length > 0 && (
            <>
              <label htmlFor="idea-tag" className="sr-only">
                Tag
              </label>
              <select
                id="idea-tag"
                name="tag"
                defaultValue={tagId ?? ""}
                className={cn(controlClass, "h-8 w-auto rounded-full py-1 text-[0.8125rem]")}
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
          <Button type="submit" variant="ghost" size="sm">
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
            <ul aria-label="Ideas" className="divide-y divide-border border-y border-border">
              {ideas.map((idea) => (
                <li key={idea.id} className="group flex items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/inbox/${idea.id}`}
                      className="text-sm break-words hover:underline"
                    >
                      {idea.title}
                    </Link>
                    <p className="mt-0.5 flex min-w-0 gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">
                        {formatDate(dateOfInstant(idea.created_at, ctx.timezone), "short")}
                      </span>
                      {status === "all" && (
                        <span className="shrink-0">{IDEA_STATUS_LABELS[idea.status]}</span>
                      )}
                      {idea.tags.map((t) => (
                        <span key={t.id} className="shrink-0">
                          #{t.name}
                        </span>
                      ))}
                      {idea.body && <span className="min-w-0 truncate">{idea.body}</span>}
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
                      className={buttonClass({ variant: "outline", size: "sm" })}
                    >
                      Previous
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className={buttonClass({
                        variant: "outline",
                        size: "sm",
                        className: "opacity-50",
                      })}
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
                      className={buttonClass({ variant: "outline", size: "sm" })}
                    >
                      Next
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className={buttonClass({
                        variant: "outline",
                        size: "sm",
                        className: "opacity-50",
                      })}
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
