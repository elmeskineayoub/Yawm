import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { JournalActions } from "@/components/journal/journal-actions";
import { NewEntry } from "@/components/journal/new-entry";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/field";
import { energyLabel, entryPreview, groupByMonth, moodLabel } from "@/features/journal/logic";
import { loadJournalEntries, loadJournalMonths } from "@/features/journal/queries";
import { formatDate, formatPeriod } from "@/lib/dates";
import { normalizeQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Journal" };

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = normalizeQuery(params.q);
  const rawMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : null;
  const rawTag = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const tagId = z.uuid().safeParse(rawTag).success ? (rawTag as string) : null;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Number.parseInt(rawPage ?? "1", 10);

  const ctx = await getWorkspaceContext();
  const [result, months, tags] = await Promise.all([
    loadJournalEntries(
      ctx,
      { q, tagId, month },
      { page: Number.isFinite(requestedPage) ? requestedPage : 1 },
    ),
    loadJournalMonths(ctx),
    ctx.supabase.from("tags").select("id, name").eq("workspace_id", ctx.workspace.id).order("name"),
  ]);

  const { entries, total, page, pageCount, pageSize } = result;
  const groups = groupByMonth(entries);

  const journalHref = (targetPage: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (month) search.set("month", month);
    if (tagId) search.set("tag", tagId);
    if (targetPage > 1) search.set("page", String(targetPage));
    const s = search.toString();
    return s ? `/journal?${s}` : "/journal";
  };
  const firstShown = (page - 1) * pageSize + 1;
  const lastShown = firstShown + entries.length - 1;

  return (
    <>
      <PageHeader
        title="Journal"
        description="A dated space to reflect. Entries autosave and stay private to your workspace."
      />
      <div className="space-y-4">
        <NewEntry today={ctx.today} />

        <form
          method="get"
          role="search"
          aria-label="Search journal"
          className="flex flex-wrap gap-2"
        >
          <label htmlFor="journal-search" className="sr-only">
            Search journal
          </label>
          <input
            id="journal-search"
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search entries"
            className={cn(controlClass, "min-w-0 flex-1 basis-48 py-1.5")}
          />
          {months.length > 0 && (
            <>
              <label htmlFor="journal-month" className="sr-only">
                Month
              </label>
              <select
                id="journal-month"
                name="month"
                defaultValue={month ?? ""}
                className={cn(controlClass, "w-auto py-1.5")}
              >
                <option value="">All months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatPeriod("month", `${m}-01`)}
                  </option>
                ))}
              </select>
            </>
          )}
          {(tags.data ?? []).length > 0 && (
            <>
              <label htmlFor="journal-tag" className="sr-only">
                Tag
              </label>
              <select
                id="journal-tag"
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

        {entries.length === 0 ? (
          <EmptyState title={q || tagId || month ? "No matching entries" : "No entries yet"}>
            {q || tagId || month ? "Try another search or month." : "Start your first entry above."}
          </EmptyState>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.month} aria-label={formatPeriod("month", `${group.month}-01`)}>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {formatPeriod("month", `${group.month}-01`)}
                </h2>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {group.entries.map((entry) => {
                    const mood = moodLabel(entry.mood);
                    const energy = energyLabel(entry.energy);
                    return (
                      <li
                        key={entry.id}
                        className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/journal/${entry.id}`}
                            className="text-sm font-medium break-words hover:underline"
                          >
                            {entry.title?.trim() || formatDate(entry.entry_date)}
                          </Link>
                          {entryPreview(entry.body) && (
                            <p className="mt-0.5 line-clamp-2 text-sm break-words text-muted-foreground">
                              {entryPreview(entry.body)}
                            </p>
                          )}
                          <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(entry.entry_date, "short")}</span>
                            {mood && <span>Mood: {mood}</span>}
                            {energy && <span>Energy: {energy}</span>}
                            {entry.tags.map((t) => (
                              <span key={t.id}>#{t.name}</span>
                            ))}
                          </p>
                        </div>
                        <JournalActions
                          entry={{ id: entry.id, label: entry.title?.trim() || "this entry" }}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <nav
              aria-label="Journal pages"
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <p role="status" className="text-muted-foreground">
                {total <= pageSize
                  ? `${total} entr${total === 1 ? "y" : "ies"}`
                  : `Showing ${firstShown}–${lastShown} of ${total} entries`}
              </p>
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={journalHref(page - 1)}
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
                      href={journalHref(page + 1)}
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
