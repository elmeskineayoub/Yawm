import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { notFound } from "next/navigation";
import { z } from "zod";
import { JournalActions } from "@/components/journal/journal-actions";
import { JournalEditor } from "@/components/journal/journal-editor";
import { loadJournalEntry } from "@/features/journal/queries";
import { formatDate } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Journal entry" };

export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ctx = await getWorkspaceContext();
  const entry = await loadJournalEntry(ctx, id);
  if (!entry) notFound();

  const heading = entry.title?.trim() || formatDate(entry.entry_date);

  return (
    <>
      <PageHeader
        title={heading}
        breadcrumb={[{ label: "Journal", href: "/journal" }]}
        actions={<JournalActions entry={{ id: entry.id, label: heading }} afterDelete="/journal" />}
      />
      <section
        aria-label="Journal entry"
        className="rounded-lg border border-border bg-surface p-5"
      >
        <JournalEditor entry={entry} />
      </section>
    </>
  );
}
