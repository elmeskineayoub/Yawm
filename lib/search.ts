/** Escapes LIKE wildcards so user input matches literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Builds a PostgREST `or` filter matching `query` case-insensitively in any of `columns`.
 * Values are double-quoted so commas, dots, and parentheses in user input cannot inject extra
 * filter clauses. (PostgREST also treats `*` as a wildcard; that only widens a user's own search.)
 */
export function ilikeAny(columns: readonly string[], query: string): string {
  const pattern = `%${escapeLike(query.trim())}%`;
  const quoted = `"${pattern.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}

/** Normalises a search box value; returns null when there is nothing to search for. */
export function normalizeQuery(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim().slice(0, 200);
  return trimmed ? trimmed : null;
}
