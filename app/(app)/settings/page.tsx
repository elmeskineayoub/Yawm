import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AreasManager } from "@/components/settings/areas-manager";
import { GoogleCalendarSettings } from "@/components/settings/google-calendar";
import { ProfileForm } from "@/components/settings/profile-form";
import { ImportRestore } from "@/components/settings/import-restore";
import { ReminderSettings } from "@/components/settings/reminder-settings";
import { ThemeSelector } from "@/components/shared/theme-selector";
import { loadGoogleOverview, loadOwnedCalendars } from "@/features/google-calendar/queries";
import { loadReminderPreferences } from "@/features/reminders/queries";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getWorkspaceContext();
  const { supabase, user, workspace } = ctx;
  const googleOutcome = (await searchParams).google;
  const google = await loadGoogleOverview(ctx);
  const [{ data: profile }, areas, usage, owned, reminderPrefs] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, timezone, week_start")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("areas")
      .select("id, name, color, archived_at")
      .eq("workspace_id", workspace.id)
      .order("sort_order")
      .order("name"),
    supabase
      .from("tasks")
      .select("area_id")
      .eq("workspace_id", workspace.id)
      .not("area_id", "is", null)
      .limit(10_000),
    loadOwnedCalendars(google),
    loadReminderPreferences(ctx),
  ]);
  const usageByArea = new Map<string, number>();
  for (const row of usage.data ?? []) {
    if (row.area_id) usageByArea.set(row.area_id, (usageByArea.get(row.area_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <section
          aria-labelledby="account-heading"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2 id="account-heading" className="text-base font-semibold">
            Account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Changing your timezone changes how times are shown. Scheduled blocks keep their exact
            moment.
          </p>
          {profile ? (
            <ProfileForm email={user.email} profile={profile} />
          ) : (
            <p role="alert" className="mt-2 text-sm">
              Your profile could not be loaded.
            </p>
          )}
        </section>
        <section
          aria-labelledby="areas-heading"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2 id="areas-heading" className="text-base font-semibold">
            Life areas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Rename, recolor, reorder, or archive areas, or add your own.
          </p>
          {areas.error ? (
            <p role="alert" className="mt-3 text-sm">
              Your areas could not be loaded.
            </p>
          ) : (
            <div className="mt-3">
              <AreasManager
                areas={areas.data.map((a) => ({ ...a, usage: usageByArea.get(a.id) ?? 0 }))}
              />
            </div>
          )}
        </section>
        <section
          id="google"
          aria-labelledby="google-heading"
          className="scroll-mt-6 rounded-lg border border-border bg-surface p-6"
        >
          <h2 id="google-heading" className="text-base font-semibold">
            Google Calendar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional. See your Google events next to your plan, and send time blocks to Google.
          </p>
          <GoogleCalendarSettings
            state={google.state}
            calendars={owned.calendars.map(({ id, name, primary }) => ({ id, name, primary }))}
            calendarsError={owned.error}
            outcome={typeof googleOutcome === "string" ? googleOutcome : null}
            timezone={ctx.timezone}
          />
        </section>
        <section
          aria-labelledby="reminders-heading"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2 id="reminders-heading" className="text-base font-semibold">
            Reminders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which reminders appear in the bell while Yawm is open. Yawm does not send
            notifications when it is closed.
          </p>
          <ReminderSettings initial={reminderPrefs} />
        </section>
        <section
          aria-labelledby="data-heading"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2 id="data-heading" className="text-base font-semibold">
            Data &amp; backup
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download your workspace, or restore it from a backup file. The JSON backup is the
            complete copy; CSV and Markdown are for use in other tools. Vision-board images are
            referenced by path, not included in these files. Secrets (Google tokens) are never
            exported.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/api/export?format=json"
              download
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Download full backup (JSON)
            </a>
            <a
              href="/api/export?format=tasks-csv"
              download
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-surface-muted"
            >
              Tasks (CSV)
            </a>
            <a
              href="/api/export?format=journal-md"
              download
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-surface-muted"
            >
              Journal (Markdown)
            </a>
          </div>
          <ImportRestore />
        </section>
        <section
          aria-labelledby="appearance-heading"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2 id="appearance-heading" className="text-base font-semibold">
            Appearance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Stored in this browser only.</p>
          <div className="mt-4">
            <ThemeSelector />
          </div>
        </section>
      </div>
    </>
  );
}
