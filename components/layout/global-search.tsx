"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Kbd } from "@/components/ui/kbd";
import { dialogClass, overlayClass } from "@/components/ui/surfaces";
import { Tooltip } from "@/components/ui/tooltip";
import {
  cleanQuery,
  highlightParts,
  moduleSearchHref,
  SEARCH_TYPE_LABELS,
  type SearchResponse,
} from "@/features/search/logic";
import type { ShellLayout } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { isTypingTarget } from "@/lib/keyboard";

const DEBOUNCE_MS = 200;

type Context = { open: () => void };
const SearchContext = createContext<Context | null>(null);

function useGlobalSearch(): Context {
  const value = useContext(SearchContext);
  if (!value) throw new Error("SearchButton must be inside GlobalSearchProvider.");
  return value;
}

/**
 * Global search across tasks, projects, goals, ideas, notes, and journal entries (REQUIREMENTS
 * 9). Results and navigation only: this is a search, not a command palette. Press "/" anywhere
 * outside a text field to open it.
 */
export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open: () => setOpen(true) }), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || document.querySelector("[role=dialog]")) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <SearchContext.Provider value={value}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={overlayClass} />
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              dialogClass,
              "top-[10%] flex max-h-[80dvh] max-w-xl translate-y-0 flex-col overflow-hidden p-0",
            )}
          >
            <Dialog.Title className="sr-only">Search</Dialog.Title>
            {/* Mounted only while open, so each opening starts fresh. */}
            {open && <SearchPanel onNavigate={() => setOpen(false)} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </SearchContext.Provider>
  );
}

type State =
  | { status: "idle" }
  | { status: "loading"; previous: SearchResponse | null }
  | { status: "done"; data: SearchResponse }
  | { status: "error"; message: string; previous: SearchResponse | null };

type Option = { id: string; href: string };

function SearchPanel({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const baseId = useId();
  const listId = `${baseId}-results`;
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const query = cleanQuery(input);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((s) => ({
        status: "loading",
        previous: s.status === "done" ? s.data : s.status === "idle" ? null : s.previous,
      }));
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        // A redirect to the sign-in page means the session ended.
        if (res.redirected || !res.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Your session has ended. Sign in again to search.");
        }
        const body: unknown = await res.json();
        if (!res.ok) {
          const message =
            typeof body === "object" && body && "error" in body && typeof body.error === "string"
              ? body.error
              : "Search isn't available right now. Try again.";
          throw new Error(message);
        }
        setState({ status: "done", data: body as SearchResponse });
        setActive(0);
      } catch (error) {
        if (controller.signal.aborted) return;
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setState((s) => ({
          status: "error",
          message: offline
            ? "You're offline. Search needs a connection."
            : error instanceof Error && error.message
              ? error.message
              : "Search isn't available right now. Try again.",
          previous: s.status === "done" ? s.data : s.status === "loading" ? s.previous : null,
        }));
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  // Show the latest results we have while a newer search is in flight (no flicker).
  const data: SearchResponse | null = !query
    ? null
    : state.status === "done"
      ? state.data
      : state.status === "loading" || state.status === "error"
        ? state.previous
        : null;
  const stale = data !== null && data.query !== query;

  const options: Option[] = [];
  const optionId = (n: number) => `${baseId}-opt-${n}`;
  const groups = (data?.groups ?? []).map((group) => {
    const items = group.results.map((result) => {
      const index = options.push({ id: optionId(options.length), href: result.href }) - 1;
      return { result, index };
    });
    const seeAllHref = group.more && data ? moduleSearchHref(group.type, data.query) : null;
    const seeAll =
      seeAllHref !== null
        ? {
            href: seeAllHref,
            index: options.push({ id: optionId(options.length), href: seeAllHref }) - 1,
          }
        : null;
    return { group, items, seeAll };
  });
  const activeIndex = Math.min(active, Math.max(0, options.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector(`[id="${optionId(activeIndex)}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
    // optionId is derived from baseId, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const go = (href: string) => {
    onNavigate();
    router.push(href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) go(option.href);
    }
  };

  const loading = query !== null && (state.status === "loading" || stale);
  const total = data?.groups.reduce((n, g) => n + g.results.length, 0) ?? 0;
  const announcement = !query
    ? ""
    : loading
      ? "Searching…"
      : state.status === "error"
        ? state.message
        : total === 0
          ? "No results."
          : `${total} result${total === 1 ? "" : "s"}.`;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          role="combobox"
          aria-label="Search everything"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options.length > 0 ? optionId(activeIndex) : undefined}
          autoFocus
          value={input}
          maxLength={200}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search tasks, projects, goals, ideas, notes, journal…"
          className="h-12 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
        />
        {loading && (
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-border border-t-accent"
          />
        )}
        <Kbd className="hidden sm:inline-flex">Esc</Kbd>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {!query ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {input.trim().length > 0
              ? "Keep typing…"
              : "Find anything in your workspace by title or text. Results stay in your workspace."}
          </p>
        ) : state.status === "error" && !data ? (
          <p role="alert" className="px-4 py-6 text-sm text-danger">
            {state.message}
          </p>
        ) : data && total === 0 && !loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nothing matches “{data.query}”.</p>
        ) : (
          <div
            id={listId}
            role="listbox"
            aria-label="Search results"
            className={cn("py-2", stale && "opacity-60")}
          >
            {state.status === "error" && (
              <p role="alert" className="px-4 pb-2 text-xs text-danger">
                {state.message}
              </p>
            )}
            {groups.map(({ group, items, seeAll }) => (
              <div key={group.type} role="group" aria-label={SEARCH_TYPE_LABELS[group.type]}>
                <p aria-hidden className="label-caps px-4 pt-3 pb-1">
                  {SEARCH_TYPE_LABELS[group.type]}
                </p>
                {items.map(({ result, index }) => (
                  <Link
                    key={result.id}
                    id={optionId(index)}
                    href={result.href}
                    role="option"
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    onClick={onNavigate}
                    onMouseMove={() => index !== activeIndex && setActive(index)}
                    className={cn(
                      "mx-2 block rounded-md px-2 py-2",
                      index === activeIndex && "bg-surface-muted",
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm">
                        <Highlighted text={result.title} query={data?.query ?? ""} />
                      </span>
                      {result.meta && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {result.meta}
                        </span>
                      )}
                    </span>
                    {result.snippet && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        <Highlighted text={result.snippet} query={data?.query ?? ""} />
                      </span>
                    )}
                  </Link>
                ))}
                {seeAll && (
                  <Link
                    id={optionId(seeAll.index)}
                    href={seeAll.href}
                    role="option"
                    aria-selected={seeAll.index === activeIndex}
                    tabIndex={-1}
                    onClick={onNavigate}
                    onMouseMove={() => seeAll.index !== activeIndex && setActive(seeAll.index)}
                    className={cn(
                      "mx-2 block rounded-md px-2 py-1.5 text-xs text-accent",
                      seeAll.index === activeIndex && "bg-surface-muted",
                    )}
                  >
                    See all in {SEARCH_TYPE_LABELS[group.type]}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hidden items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground sm:flex">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Enter</Kbd> to open
        </span>
      </div>
    </>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-sm bg-accent-soft text-foreground">
            {part.text}
          </mark>
        ) : (
          // A bare text node, not a <span>: some name computations trim element text, which would
          // drop the space next to a highlight ("Planthe week").
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Opens global search. Sidebar: a quiet field-like button. Header: an icon button. */
export function SearchButton({
  layout = "full",
  variant = "sidebar",
}: {
  layout?: ShellLayout;
  variant?: "sidebar" | "icon";
}) {
  const { open } = useGlobalSearch();
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Search"
        className="rounded-md p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <Search aria-hidden className="size-5" />
      </button>
    );
  }
  const button = (
    <button
      type="button"
      onClick={open}
      aria-keyshortcuts="/"
      aria-label="Search"
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground transition-colors duration-150 hover:border-input-border hover:text-foreground",
        layout === "rail" && "justify-center px-0",
        layout === "responsive" && "max-lg:justify-center max-lg:px-0",
      )}
    >
      <Search aria-hidden className="size-4 shrink-0" />
      <span
        className={cn(
          "flex-1 text-left",
          layout === "rail" && "sr-only",
          layout === "responsive" && "max-lg:sr-only",
        )}
      >
        Search
      </span>
      <Kbd
        className={cn(layout === "rail" && "hidden", layout === "responsive" && "max-lg:hidden")}
      >
        /
      </Kbd>
    </button>
  );
  return layout === "full" ? (
    button
  ) : (
    <Tooltip
      content="Search"
      side="right"
      shortcut="/"
      contentClassName={layout === "responsive" ? "lg:hidden" : undefined}
    >
      {button}
    </Tooltip>
  );
}
