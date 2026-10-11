import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";
import { getCurrentWorkspace, listActiveAreas } from "@/lib/db/workspace";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const workspace = await getCurrentWorkspace(supabase, user.id);

  if (!workspace) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <p role="alert" className="text-sm">
          Your personal workspace could not be found. Sign out and back in; if this persists, the
          account setup did not complete.
        </p>
      </>
    );
  }

  const areas = await listActiveAreas(supabase, workspace.id);

  return (
    <>
      <PageHeader title="Dashboard" description={`${workspace.name} workspace`} />
      <section
        aria-labelledby="areas-heading"
        className="rounded-lg border border-border bg-surface p-6"
      >
        <h2 id="areas-heading" className="text-base font-semibold">
          Life areas
        </h2>
        {areas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No active areas.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {areas.map((area) => (
              <li
                key={area.id}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm"
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: area.color }}
                />
                {area.name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Tasks, plans, and the other modules arrive in the next phases.
        </p>
      </section>
    </>
  );
}
