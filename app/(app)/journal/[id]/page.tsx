import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="mb-2 flex items-center justify-between gap-2">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href="/journal" className="hover:underline">
            Journal
          </Link>
        </nav>
        <JournalActions entry={{ id: entry.id, label: heading }} afterDelete="/journal" />
      </div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight break-words">{heading}</h1>
      <section
        aria-label="Journal entry"
        className="rounded-lg border border-border bg-surface p-5"
      >
        <JournalEditor entry={entry} />
      </section>
    </>
  );
}
