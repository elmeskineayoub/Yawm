import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AreasManager } from "@/components/settings/areas-manager";
import { GoogleCalendarSettings } from "@/components/settings/google-calendar";
import { ProfileForm } from "@/components/settings/profile-form";
import { ImportRestore } from "@/components/settings/import-restore";
import { ReminderSettings } from "@/components/settings/reminder-settings";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SnapshotManager } from "@/components/settings/snapshot-manager";
import { buttonClass } from "@/components/ui/button";
import { ThemeSelector } from "@/components/shared/theme-selector";
import { loadGoogleOverview, loadOwnedCalendars } from "@/features/google-calendar/queries";
import { loadReminderPreferences } from "@/features/reminders/queries";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "areas", label: "Life areas" },
  { id: "google", label: "Google Calendar" },
  { id: "reminders", label: "Reminders" },
  { id: "data", label: "Data & backup" },
  { id: "appearance", label: "Appearance" },
];

// Unboxed sections separated by hairlines; scroll-margin keeps headings clear of the sticky nav.
const sectionClass =
  "scroll-mt-28 border-t border-border pt-8 first:border-t-0 first:pt-0 lg:scroll-mt-8";

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
      <PageHeader
        title="Settings"
        description="Your account, life areas, connections, reminders, and data."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="sticky top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur lg:top-[calc(env(safe-area-inset-top,0px)+1.5rem)] lg:mx-0 lg:self-start lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <SettingsNav sections={SECTIONS} />
        </div>
        <div className="min-w-0 max-w-3xl space-y-12">
          <section id="account" aria-labelledby="account-heading" className={sectionClass}>
            <h2 id="account-heading" className="font-serif text-xl">
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
          <section id="areas" aria-labelledby="areas-heading" className={sectionClass}>
            <h2 id="areas-heading" className="font-serif text-xl">
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
          <section id="google" aria-labelledby="google-heading" className={sectionClass}>
            <h2 id="google-heading" className="font-serif text-xl">
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
          <section id="reminders" aria-labelledby="reminders-heading" className={sectionClass}>
            <h2 id="reminders-heading" className="font-serif text-xl">
              Reminders
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose which reminders appear in the bell while Yawm is open. Yawm does not send
              notifications when it is closed.
            </p>
            <ReminderSettings initial={reminderPrefs} />
          </section>
          <section id="data" aria-labelledby="data-heading" className={sectionClass}>
            <h2 id="data-heading" className="font-serif text-xl">
              Data &amp; backup
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Download your workspace, or restore it from a backup file. The JSON backup is the
              complete copy; CSV and Markdown are for use in other tools. Vision-board images are
              referenced by path, not included in these files. Secrets (Google tokens) are never
              exported.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/api/export?format=json" download className={buttonClass()}>
                Download full backup (JSON)
              </a>
              <a
                href="/api/export?format=tasks-csv"
                download
                className={buttonClass({ variant: "outline" })}
              >
                Tasks (CSV)
              </a>
              <a
                href="/api/export?format=journal-md"
                download
                className={buttonClass({ variant: "outline" })}
              >
                Journal (Markdown)
              </a>
            </div>
            <ImportRestore workspaceId={workspace.id} />
            <SnapshotManager workspaceId={workspace.id} today={ctx.today} timezone={ctx.timezone} />
          </section>
          <section id="appearance" aria-labelledby="appearance-heading" className={sectionClass}>
            <h2 id="appearance-heading" className="font-serif text-xl">
              Appearance
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Stored in this browser only.</p>
            <div className="mt-4">
              <ThemeSelector />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
