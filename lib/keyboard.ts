/** True when a key press is meant for a text field, not for a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Whether a single-key shortcut should run: no modifier keys (Shift is allowed, for "?"), not
 * while typing, and not on top of an open dialog or side panel.
 */
export function isShortcutEvent(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (isTypingTarget(event.target)) return false;
  if (typeof document !== "undefined" && document.querySelector("[role=dialog]")) return false;
  return true;
}

/** Visible rows marked for j/k navigation, in document order. */
export function navItems(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("main [data-nav-item]")].filter(
    (el) => el.getClientRects().length > 0,
  );
}

/**
 * The row to focus after j (next) or k (previous). Starts from the row that holds focus (the link
 * itself or anything else in its list item); with nothing focused yet, j picks the first row and
 * k the last.
 */
export function nextNavItem(
  items: HTMLElement[],
  active: Element | null,
  direction: 1 | -1,
): HTMLElement | null {
  if (items.length === 0) return null;
  const current = items.findIndex(
    (el) => el === active || (active !== null && el.closest("li")?.contains(active)),
  );
  if (current === -1) return direction === 1 ? items[0]! : items[items.length - 1]!;
  const next = current + direction;
  return next < 0 || next >= items.length ? items[current]! : items[next]!;
}
