import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { JournalPromptCard } from "@/components/dashboard/journal-prompt-card";
import { AppShell } from "@/components/layout/app-shell";
import { dailyPrompt } from "@/features/dashboard/logic";
import { buildDashboardModel } from "@/features/dashboard/model";
import { designPreviewEnabled } from "@/lib/design-preview";
import { formatDate } from "@/lib/dates";
import { dashboardFixture, FIXTURE_TIMEZONE, FIXTURE_TODAY } from "@/tests/fixtures/dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard (design preview)", robots: { index: false } };

/**
 * The real Dashboard view and app shell, fed by the synthetic design fixture instead of the
 * database (lib/design-preview.ts). Development only; 404 everywhere else. Nothing here reads or
 * writes Supabase; controls that would save (checkboxes, capture) are not meant to be used.
 */
export default function DashboardPreviewPage() {
  if (!designPreviewEnabled()) notFound();
  const input = dashboardFixture();
  return (
    <AppShell inboxCount={input.inbox} today={FIXTURE_TODAY}>
      <DashboardView
        model={buildDashboardModel(input)}
        today={FIXTURE_TODAY}
        timezone={FIXTURE_TIMEZONE}
        dateLabel={formatDate(FIXTURE_TODAY)}
        hidden={new Set()}
        reflect={
          <JournalPromptCard
            prompt={dailyPrompt(FIXTURE_TODAY)}
            today={FIXTURE_TODAY}
            variant="secondary"
          />
        }
      />
    </AppShell>
  );
}
