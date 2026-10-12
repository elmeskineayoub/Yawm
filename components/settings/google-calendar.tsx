"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  saveGoogleCalendars,
  syncGoogleCalendar,
} from "@/features/google-calendar/actions";
import type { GoogleConnectionState } from "@/features/google-calendar/types";

const OUTCOMES: Record<string, { tone: "success" | "error"; text: string }> = {
  connected: { tone: "success", text: "Google Calendar connected." },
  denied: { tone: "error", text: "Google Calendar wasn't connected: access was declined." },
  state: {
    tone: "error",
    text: "That connection attempt expired or didn't match this session. Try connecting again.",
  },
  scopes: {
    tone: "error",
    text: "Calendar access wasn't fully granted. Connect again and allow both calendar permissions.",
  },
  no_refresh: { tone: "error", text: "Google didn't grant ongoing access. Try connecting again." },
  taken: {
    tone: "error",
    text: "Another member has already connected Google Calendar for this workspace.",
  },
  failed: { tone: "error", text: "Couldn't finish connecting to Google. Try again." },
  unavailable: { tone: "error", text: "Google Calendar isn't configured on this server." },
};

type Calendar = { id: string; name: string; primary: boolean };

function formatInstant(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function ConnectButton({ label }: { label: string }) {
  return (
    <form action={connectGoogleCalendar}>
      <Button type="submit">{label}</Button>
    </form>
  );
}

export function GoogleCalendarSettings({
  state,
  calendars,
  calendarsError,
  outcome,
  timezone,
}: {
  state: GoogleConnectionState;
  calendars: Calendar[];
  calendarsError: string | null;
  outcome: string | null;
  timezone: string;
}) {
  const notice = outcome ? OUTCOMES[outcome] : undefined;

  return (
    <div className="mt-3 space-y-4">
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={
            notice.tone === "error"
              ? "text-sm text-red-700 dark:text-red-400"
              : "text-sm text-green-800 dark:text-green-300"
          }
        >
          {notice.text}
        </p>
      )}
      {!state.available ? (
        <NotConfigured state={state} />
      ) : !state.connected ? (
        <div className="space-y-3 text-sm">
          <About />
          <ConnectButton label="Connect Google Calendar" />
        </div>
      ) : (
        <Connected
          state={state}
          calendars={calendars}
          calendarsError={calendarsError}
          timezone={timezone}
        />
      )}
    </div>
  );
}

function About() {
  return (
    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
      <li>Events from calendars you choose appear in the Planner, read-only.</li>
      <li>
        Your time blocks are added to one calendar you own: title and time only. Notes, tasks,
        journals, and ideas are never sent.
      </li>
      <li>
        Changes go one way, from Yawm to Google. Editing an event in Google doesn&apos;t change
        Yawm.
      </li>
    </ul>
  );
}

function NotConfigured({ state }: { state: Extract<GoogleConnectionState, { available: false }> }) {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>
        Google Calendar isn&apos;t set up on this server, so it&apos;s turned off. Everything else,
        including scheduling time blocks, works without it.
      </p>
      {state.reason === "misconfigured" && (
        <>
          <p>The integration is switched on but its server settings are incomplete:</p>
          <ul className="list-disc pl-5">
            {state.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      )}
      <p>See &ldquo;Google Calendar (optional)&rdquo; in the README for setup.</p>
    </div>
  );
}

function Connected({
  state,
  calendars,
  calendarsError,
  timezone,
}: {
  state: Extract<GoogleConnectionState, { connected: true }>;
  calendars: Calendar[];
  calendarsError: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(state.targetCalendarId ?? "");
  const [show, setShow] = useState<string[]>(state.readCalendarIds);
  const [saving, startSaving] = useTransition();
  const [syncing, startSyncing] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const needsReconnect = state.status === "reconnect_required";

  const save = () =>
    startSaving(async () => {
      setMessage(null);
      const result = await saveGoogleCalendars({ target, show });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({ tone: "ok", text: "Calendar choice saved." });
      router.refresh();
    });

  const syncNow = () =>
    startSyncing(async () => {
      setMessage(null);
      const result = await syncGoogleCalendar(true);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const s = result.data;
      if (s.stopped || s.failed) {
        setMessage({ tone: "error", text: s.message ?? "Some blocks didn't sync." });
      } else {
        const changed = s.pushed + s.deleted;
        setMessage({
          tone: "ok",
          text:
            changed === 0
              ? "Everything is already in sync."
              : `Synced ${changed} ${changed === 1 ? "change" : "changes"}${
                  s.remaining ? `; ${s.remaining} still waiting` : ""
                }.`,
        });
      }
      router.refresh();
    });

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Connected as <span className="font-medium">{state.email ?? "your Google account"}</span>
        </span>
        {needsReconnect ? (
          <Badge tone="danger">Reconnect needed</Badge>
        ) : state.status === "error" ? (
          <Badge tone="warning">Needs attention</Badge>
        ) : (
          <Badge tone="success">Active</Badge>
        )}
      </div>

      {needsReconnect && (
        <div role="alert" className="space-y-2">
          <p className="text-red-700 dark:text-red-400">
            {state.lastError ?? "Google Calendar access was revoked or expired."} Your time blocks
            are safe in Yawm.
          </p>
          <ConnectButton label="Reconnect Google Calendar" />
        </div>
      )}

      {!needsReconnect && (
        <fieldset className="space-y-3" disabled={saving}>
          <legend className="font-medium">Calendars</legend>
          {calendarsError ? (
            <p role="alert" className="text-red-700 dark:text-red-400">
              Your calendars couldn&apos;t be loaded. {calendarsError}
            </p>
          ) : calendars.length === 0 ? (
            <p className="text-muted-foreground">No calendars you own were found.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 font-normal">Calendar</th>
                  <th className="px-2 py-1 font-normal">Add blocks here</th>
                  <th className="px-2 py-1 font-normal">Show events</th>
                </tr>
              </thead>
              <tbody>
                {calendars.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-2 break-all">
                      {c.name}
                      {c.primary && <span className="text-muted-foreground"> (primary)</span>}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="radio"
                        name="google-target"
                        aria-label={`Add blocks to ${c.name}`}
                        checked={target === c.id}
                        onChange={() => setTarget(c.id)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Show events from ${c.name}`}
                        checked={show.includes(c.id)}
                        onChange={(e) =>
                          setShow((ids) =>
                            e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {calendars.length > 0 && (
            <Button variant="secondary" onClick={save} disabled={saving || !target}>
              {saving ? "Saving…" : "Save calendars"}
            </Button>
          )}
        </fieldset>
      )}

      {!needsReconnect && (
        <div className="space-y-2">
          <p className="font-medium">Sync</p>
          <p className="text-muted-foreground">
            {state.targetCalendarName
              ? `Time blocks go to ${state.targetCalendarName}.`
              : "Choose a calendar to start syncing."}{" "}
            {state.lastSyncedAt
              ? `Last synced ${formatInstant(state.lastSyncedAt, timezone)}.`
              : "Not synced yet."}{" "}
            {state.pending > 0 && `${state.pending} waiting. `}
            {state.failed > 0 && `${state.failed} failed. `}
          </p>
          {state.lastError && state.status !== "reconnect_required" && (
            <p className="text-amber-800 dark:text-amber-300">{state.lastError}</p>
          )}
          <Button
            variant="secondary"
            onClick={syncNow}
            disabled={syncing || !state.targetCalendarId}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      )}

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={message.tone === "error" ? "text-red-700 dark:text-red-400" : undefined}
        >
          {message.text}
        </p>
      )}

      <ConfirmDialog
        trigger={<Button variant="ghost">Disconnect</Button>}
        title="Disconnect Google Calendar?"
        description={
          <p>
            Yawm deletes its stored Google credentials and asks Google to revoke access. Events Yawm
            already added stay in your Google Calendar; delete them there if you don&apos;t want
            them. Your time blocks stay in Yawm.
          </p>
        }
        confirmLabel="Disconnect"
        onConfirm={async () => {
          const result = await disconnectGoogleCalendar();
          if (!result.ok) return result.error;
          toast.success(
            result.data.revoked
              ? "Google Calendar disconnected"
              : "Disconnected. Google didn't confirm revoking access; you can remove Yawm in your Google Account's security settings.",
          );
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}
