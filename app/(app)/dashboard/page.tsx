import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Your command center for today." />
      <section
        aria-labelledby="foundation-heading"
        className="rounded-lg border border-border bg-surface p-6"
      >
        <h2 id="foundation-heading" className="text-base font-semibold">
          Nothing here yet
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          This is the application foundation. Accounts, tasks, plans, and the rest of the modules
          are added in later implementation phases. No data is stored yet.
        </p>
      </section>
    </>
  );
}
