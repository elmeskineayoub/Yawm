/** Client-safe shapes for Google Calendar state. Never add tokens or secrets here. */

/** A Google event shown read-only in the Planner. */
export type ExternalEvent = {
  id: string;
  title: string;
  calendarName: string;
  /** Timed events: UTC instants. All-day events: date-only start and exclusive end. */
  start: string;
  end: string;
  allDay: boolean;
  /** Marked "free" in Google: shown, but not counted as busy. */
  free: boolean;
};

export type BlockSyncState = "synced" | "pending" | "error";

export type GoogleConnectionState =
  | { available: false; reason: "disabled" | "misconfigured"; problems: string[] }
  | { available: true; connected: false }
  | {
      available: true;
      connected: true;
      status: "active" | "reconnect_required" | "error";
      email: string | null;
      targetCalendarId: string | null;
      targetCalendarName: string | null;
      readCalendarIds: string[];
      lastSyncedAt: string | null;
      lastError: string | null;
      retryAfter: string | null;
      pending: number;
      failed: number;
    };

export type SyncSummary = {
  pushed: number;
  deleted: number;
  failed: number;
  remaining: number;
  /** Why the run stopped early, if it did. */
  stopped: "not_connected" | "no_target" | "reconnect" | "rate_limited" | "forbidden" | null;
  message: string | null;
};
