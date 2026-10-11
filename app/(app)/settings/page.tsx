import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeSelector } from "@/components/shared/theme-selector";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone, week_start")
    .eq("id", user.id)
    .maybeSingle();

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
