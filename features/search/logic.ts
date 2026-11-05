/**
 * Global search (REQUIREMENTS 9): pure helpers shared by the server query and the client.
 * Search runs only against the user's own workspace in Supabase; no content leaves for a
 * third-party search or analytics service.
 */

export const SEARCH_TYPES = ["task", "project", "goal", "idea", "note", "journal"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  task: "Tasks",
  project: "Projects",
  goal: "Goals",
  idea: "Inbox",
  note: "Notes",
  journal: "Journal",
};

export type SearchResult = {
  type: SearchType;
  id: string;
  title: string;
  href: string;
  /** Text around the match when it was found in the body rather than the title. */
  snippet: string | null;
  /** Short context: status, date. */
  meta: string | null;
};

export type SearchResponse = {
  query: string;
  groups: { type: SearchType; results: SearchResult[]; more: boolean }[];
};

/** Shortest query worth sending: one character matches almost everything. */
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 200;
/** Results per type; the module's own page has the full list. */
export const RESULTS_PER_TYPE = 5;

/** Trims and bounds a raw query; null when it is too short to search. */
export function cleanQuery(raw: string | null | undefined): string | null {
  const value = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
  return value.length >= MIN_QUERY_LENGTH ? value : null;
}

/**
 * The matching passage of `text` with some context on either side, on one line, with ellipses
 * where it was cut. Null when the text does not contain the query (the match was elsewhere).
 */
export function excerpt(
  text: string | null | undefined,
  query: string,
  radius = 60,
): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return null;
  let start = Math.max(0, at - radius);
  let end = Math.min(flat.length, at + query.length + radius);
  // Prefer to cut at word boundaries.
  if (start > 0) {
    const space = flat.indexOf(" ", start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < flat.length) {
    const space = flat.lastIndexOf(" ", end);
    if (space > at + query.length) end = space;
  }
  return `${start > 0 ? "… " : ""}${flat.slice(start, end)}${end < flat.length ? " …" : ""}`;
}

/** Where each type's own, fuller search lives (for "See all" links), when it has one. */
export function moduleSearchHref(type: SearchType, query: string): string | null {
  const q = encodeURIComponent(query);
  switch (type) {
    case "task":
      return `/tasks?q=${q}&status=all`;
    case "idea":
      return `/inbox?status=all&q=${q}`;
    case "note":
      return `/notes?q=${q}`;
    case "journal":
      return `/journal?q=${q}`;
    default:
      return null;
  }
}

/** Splits text into parts so the UI can emphasise the matched query without using HTML. */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  if (!query) return [{ text, match: false }];
  const parts: { text: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
