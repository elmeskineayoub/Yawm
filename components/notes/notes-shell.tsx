import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { z } from "zod";
import { NewNote } from "@/components/notes/new-note";
import { buttonClass } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { LinkTabs } from "@/components/ui/link-tabs";
import { loadNotes } from "@/features/notes/queries";
import { dateOfInstant, formatDate } from "@/lib/dates";
import { normalizeQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { WorkspaceContext } from "@/lib/workspace-context";

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The list's filters, read from the URL so they survive opening a note. */
export function noteListState(params: Params) {
  const archived = first(params.view) === "archived";
  const q = normalizeQuery(params.q);
  const rawTag = first(params.tag);
  const tagId = z.uuid().safeParse(rawTag).success ? (rawTag as string) : null;
  const requested = Number.parseInt(first(params.page) ?? "1", 10);
  const page = Number.isFinite(requested) ? requested : 1;
  const query = new URLSearchParams();
  if (archived) query.set("view", "archived");
  if (q) query.set("q", q);
  if (tagId) query.set("tag", tagId);
  if (page > 1) query.set("page", String(page));
  return { archived, q, tagId, page, query: query.toString() };
}

/**
 * Notes as two panes: the list on the left (search, Active/Archived, tags) and the open note on
 * the right. On narrow screens only one pane shows: the list, or the note with a way back.
 */
export async function NotesShell({
  ctx,
  params,
  selectedId,
  selectedTitle,
  children,
}: {
  ctx: WorkspaceContext;
  params: Params;
  selectedId: string | null;
  selectedTitle?: string;
  children: ReactNode;
}) {
  const state = noteListState(params);
  const { archived, q, tagId } = state;
  const [result, tags] = await Promise.all([
    loadNotes(ctx, { q, tagId, archived }, { page: state.page }),
    ctx.supabase.from("tags").select("id, name").eq("workspace_id", ctx.workspace.id).order("name"),
  ]);
  const { notes, total, page, pageCount } = result;

  const listHref = (next: { archived?: boolean; page?: number }) => {
    const search = new URLSearchParams();
    if (next.archived ?? archived) search.set("view", "archived");
    if (q) search.set("q", q);
    if (tagId) search.set("tag", tagId);
    if (next.page && next.page > 1) search.set("page", String(next.page));
    const s = search.toString();
    return s ? `/notes?${s}` : "/notes";
  };
  const noteHref = (id: string) => `/notes/${id}${state.query ? `?${state.query}` : ""}`;
  const Heading = selectedId ? "h2" : "h1";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside
        aria-label="Notes list"
        className={cn(
          "min-w-0 lg:border-r lg:border-border lg:pr-6",
          selectedId && "hidden lg:block",
        )}
      >
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <Heading className="page-title">Notes</Heading>
          <span className="text-sm text-muted-foreground tabular-nums">{total}</span>
        </div>
        {!archived && <NewNote listQuery={state.query} />}
        <LinkTabs
          label="Note view"
          current={archived ? "archived" : "active"}
          className="mt-4"
          tabs={[
            { key: "active", href: listHref({ archived: false }), label: "Active" },
            { key: "archived", href: listHref({ archived: true }), label: "Archived" },
          ]}
        />
        <form
          method="get"
          action="/notes"
          role="search"
          aria-label="Search notes"
          className="mt-3 flex gap-2"
        >
          {archived && <input type="hidden" name="view" value="archived" />}
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <label htmlFor="note-search" className="sr-only">
              Search notes
            </label>
            <input
              id="note-search"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search notes"
              className={cn(controlClass, "h-8 rounded-full py-1 pl-8 text-[0.8125rem]")}
            />
          </div>
          {(tags.data ?? []).length > 0 && (
            <>
              <label htmlFor="note-tag" className="sr-only">
                Tag
              </label>
              <select
                id="note-tag"
                name="tag"
                defaultValue={tagId ?? ""}
                className={cn(controlClass, "h-8 w-24 rounded-full py-1 text-[0.8125rem]")}
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
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            {q || tagId
              ? "No notes match. Try another search."
              : archived
                ? "Nothing archived."
                : "No notes yet. Name one above to start writing."}
          </p>
        ) : (
          <ul aria-label="Notes" className="mt-3 -mx-2 space-y-0.5">
            {notes.map((note) => {
              const current = note.id === selectedId;
              return (
                <li key={note.id}>
                  <Link
                    href={noteHref(note.id)}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-2 transition-colors",
                      current ? "bg-accent-soft" : "hover:bg-surface-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "block truncate text-sm",
                        current ? "font-medium text-foreground" : "text-foreground",
                      )}
                    >
                      {note.title}
                    </span>
                    <span className="mt-0.5 flex min-w-0 gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">
                        {formatDate(dateOfInstant(note.updated_at, ctx.timezone), "short")}
                      </span>
                      {note.tags.slice(0, 2).map((t) => (
                        <span key={t.id} className="shrink-0">
                          #{t.name}
                        </span>
                      ))}
                      {note.body && <span className="min-w-0 truncate">{note.body}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {pageCount > 1 && (
          <nav
            aria-label="Note pages"
            className="mt-3 flex items-center justify-between gap-2 text-xs"
          >
            {page > 1 ? (
              <Link
                href={listHref({ page: page - 1 })}
                rel="prev"
                className={buttonClass({ variant: "ghost", size: "xs" })}
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link
                href={listHref({ page: page + 1 })}
                rel="next"
                className={buttonClass({ variant: "ghost", size: "xs" })}
              >
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </aside>

      <section
        aria-label={selectedTitle ? `Note: ${selectedTitle}` : "Note"}
        className={cn("min-w-0", !selectedId && "hidden lg:block")}
      >
        {selectedId && (
          <>
            <Link
              href={listHref({})}
              className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden"
            >
              <ArrowLeft aria-hidden className="size-4" />
              All notes
            </Link>
            {selectedTitle && <h1 className="sr-only">{selectedTitle}</h1>}
          </>
        )}
        {children}
      </section>
    </div>
  );
}
