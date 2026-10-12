import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AreasManager } from "@/components/settings/areas-manager";
import { ThemeSelector } from "@/components/shared/theme-selector";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Settings" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SettingsPage() {
  const { supabase, user, workspace } = await getWorkspaceContext();
  const [{ data: profile }, areas, usage] = await Promise.all([
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
          {profile ? (
            <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{user.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{profile.display_name ?? "—"}</dd>
              <dt className="text-muted-foreground">Timezone</dt>
              <dd>{profile.timezone}</dd>
              <dt className="text-muted-foreground">Week starts on</dt>
              <dd>{WEEKDAYS[profile.week_start] ?? "—"}</dd>
            </dl>
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
