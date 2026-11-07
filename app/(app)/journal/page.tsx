import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { JournalActions } from "@/components/journal/journal-actions";
import { NewEntry } from "@/components/journal/new-entry";
import { PageHeader } from "@/components/layout/page-header";
import { DateNavigator } from "@/components/journal/date-navigator";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/field";
import { energyLabel, entryPreview, groupByMonth, moodLabel } from "@/features/journal/logic";
import { loadJournalDays, loadJournalEntries, loadJournalMonths } from "@/features/journal/queries";
import { dayOfWeek, formatDate, formatPeriod, isIsoDate, type IsoDate } from "@/lib/dates";
import { normalizeQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Journal" };

const MONTH_RE = /^\d{4}-\d{2}$/;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayShort = (date: IsoDate) => WEEKDAYS[dayOfWeek(date)]!;

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
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Number.parseInt(rawPage ?? "1", 10);

  const ctx = await getWorkspaceContext();
  // A day picked in the calendar pre-fills the new entry; the calendar shows the filtered month,
  // or this month.
  const startDate = isIsoDate(rawDate) && rawDate <= ctx.today ? rawDate : undefined;
  const calendarMonth = month ?? ctx.today.slice(0, 7);
  const [result, months, tags, days] = await Promise.all([
    loadJournalEntries(
      ctx,
      { q, tagId, month },
      { page: Number.isFinite(requestedPage) ? requestedPage : 1 },
    ),
    loadJournalMonths(ctx),
    ctx.supabase.from("tags").select("id, name").eq("workspace_id", ctx.workspace.id).order("name"),
    loadJournalDays(ctx, calendarMonth),
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
        description="A dated space to reflect. Entries save as you write and stay private to your workspace."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <aside aria-label="Calendar" className="min-w-0 lg:order-2">
          <div className="lg:sticky lg:top-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
            <DateNavigator
              month={calendarMonth}
              today={ctx.today}
              weekStart={ctx.weekStart}
              entries={Object.fromEntries(days)}
              filtered={month !== null}
            />
          </div>
        </aside>
        <div className="min-w-0 space-y-5 lg:order-1">
          <NewEntry
            key={startDate ?? "today"}
            today={ctx.today}
            {...(startDate ? { date: startDate } : {})}
          />

          <form
            method="get"
            role="search"
            aria-label="Search journal"
            className="flex flex-wrap items-center gap-2"
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
              className={cn(
                controlClass,
                "h-8 min-w-0 flex-1 basis-48 rounded-full py-1 text-[0.8125rem] sm:max-w-72",
              )}
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
                  className={cn(controlClass, "h-8 w-auto rounded-full py-1 text-[0.8125rem]")}
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

          {entries.length === 0 ? (
            <EmptyState title={q || tagId || month ? "No matching entries" : "No entries yet"}>
              {q || tagId || month
                ? "Try another search or month."
                : "Start your first entry above."}
            </EmptyState>
          ) : (
            <>
              {groups.map((group) => (
                <section key={group.month} aria-label={formatPeriod("month", `${group.month}-01`)}>
                  <h2 className="mb-1 label-caps">{formatPeriod("month", `${group.month}-01`)}</h2>
                  <ul className="divide-y divide-border border-y border-border">
                    {group.entries.map((entry) => {
                      const mood = moodLabel(entry.mood);
                      const energy = energyLabel(entry.energy);
                      return (
                        <li key={entry.id} className="group flex items-start gap-4 py-3">
                          <span className="w-10 shrink-0 text-center">
                            <span className="block font-serif text-xl leading-none tabular-nums">
                              {Number(entry.entry_date.slice(8))}
                            </span>
                            <span className="text-[0.6875rem] text-muted-foreground uppercase">
                              {weekdayShort(entry.entry_date)}
                            </span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              data-nav-item
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
                        href={journalHref(page + 1)}
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
      </div>
    </>
  );
}
