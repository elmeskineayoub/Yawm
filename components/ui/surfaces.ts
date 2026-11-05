/**
 * Shared class strings for floating layers, so every dialog, sheet, popover, and menu has the same
 * edge, elevation, and motion. Motion uses `data-state` from Radix and is disabled globally for
 * users who prefer reduced motion (see globals.css).
 */

/** Dimmed backdrop behind modal dialogs and sheets. */
export const overlayClass =
  "fixed inset-0 z-50 bg-overlay data-[state=open]:animate-[fade-in_150ms_ease-out]";

/** Centred modal dialog. Width is set by the caller (e.g. max-w-md). */
export const dialogClass =
  "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-overlay data-[state=open]:animate-[fade-in_150ms_ease-out]";

/** Popovers, menus, and dropdown panels anchored to a trigger. */
export const popoverClass =
  "z-50 rounded-lg border border-border bg-surface shadow-overlay data-[state=open]:animate-[fade-in_120ms_ease-out]";
