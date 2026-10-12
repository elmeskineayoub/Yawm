import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { CaptureNoteForm } from "@/components/notes/capture-note-form";
import { NoteActions } from "@/components/notes/note-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/field";
import { loadNotes } from "@/features/notes/queries";
import { dateOfInstant, formatDate } from "@/lib/dates";
import { normalizeQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Notes" };

const TABS = [
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
] as const;

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const archived = rawView === "archived";
  const q = normalizeQuery(params.q);
  const rawTag = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const tagId = z.uuid().safeParse(rawTag).success ? (rawTag as string) : null;

  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Number.parseInt(rawPage ?? "1", 10);

  const ctx = await getWorkspaceContext();
  const [result, tags] = await Promise.all([
    loadNotes(
      ctx,
      { q, tagId, archived },
      { page: Number.isFinite(requestedPage) ? requestedPage : 1 },
    ),
    ctx.supabase.from("tags").select("id, name").eq("workspace_id", ctx.workspace.id).order("name"),
  ]);

  const { notes, total, page, pageCount, pageSize } = result;

  const notesHref = (view: (typeof TABS)[number]["key"], targetPage = 1) => {
    const search = new URLSearchParams();
    if (view !== "active") search.set("view", view);
    if (q) search.set("q", q);
    if (tagId) search.set("tag", tagId);
    if (targetPage > 1) search.set("page", String(targetPage));
    const s = search.toString();
    return s ? `/notes?${s}` : "/notes";
  };
  const currentView = archived ? "archived" : "active";
  const firstShown = (page - 1) * pageSize + 1;
  const lastShown = firstShown + notes.length - 1;

  return (
    <>
      <PageHeader
        title="Notes"
        description="Text you want to keep that isn't a task or a dated journal entry."
      />
      <div className="space-y-4">
        <CaptureNoteForm />

        <nav aria-label="Note view" className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={notesHref(tab.key)}
              aria-current={currentView === tab.key ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                currentView === tab.key
                  ? "border-accent font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <form method="get" role="search" aria-label="Search notes" className="flex flex-wrap gap-2">
          {archived && <input type="hidden" name="view" value="archived" />}
          <label htmlFor="note-search" className="sr-only">
            Search notes
          </label>
          <input
            id="note-search"
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search notes"
            className={cn(controlClass, "min-w-0 flex-1 basis-48 py-1.5")}
          />
          {(tags.data ?? []).length > 0 && (
            <>
              <label htmlFor="note-tag" className="sr-only">
                Tag
              </label>
              <select
                id="note-tag"
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

        {notes.length === 0 ? (
          <EmptyState title={q || tagId ? "No matching notes" : "No notes yet"}>
            {archived
              ? "Nothing archived."
              : q || tagId
                ? "Try another search."
                : "Add your first note above."}
          </EmptyState>
        ) : (
          <>
            <ul
              aria-label="Notes"
              className="divide-y divide-border rounded-lg border border-border"
            >
              {notes.map((note) => (
                <li key={note.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/notes/${note.id}`}
                      className="text-sm font-medium break-words hover:underline"
                    >
                      {note.title}
                    </Link>
                    {note.body && (
                      <p className="mt-0.5 line-clamp-2 text-sm break-words text-muted-foreground">
                        {note.body}
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatDate(dateOfInstant(note.updated_at, ctx.timezone), "short")}
                      </span>
                      {note.tags.map((t) => (
                        <span key={t.id}>#{t.name}</span>
                      ))}
                    </p>
                  </div>
                  <NoteActions note={note} />
                </li>
              ))}
            </ul>
            <nav
              aria-label="Note pages"
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <p role="status" className="text-muted-foreground">
                {total <= pageSize
                  ? `${total} note${total === 1 ? "" : "s"}`
                  : `Showing ${firstShown}–${lastShown} of ${total} notes`}
              </p>
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={notesHref(currentView, page - 1)}
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
                      href={notesHref(currentView, page + 1)}
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
