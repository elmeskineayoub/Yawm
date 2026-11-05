/**
 * Per-device sidebar preference. A cookie rather than localStorage so the server can render the
 * right width on first paint (no layout jump). It holds no personal data.
 */
export const SIDEBAR_COOKIE = "yawm-sidebar";

export function isSidebarCollapsed(value: string | undefined): boolean {
  return value === "collapsed";
}
