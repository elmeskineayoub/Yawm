import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeSelector } from "@/components/shared/theme-selector";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
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
    </>
  );
}
