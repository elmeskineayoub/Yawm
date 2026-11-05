import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { notFound } from "next/navigation";
import { z } from "zod";
import { JournalActions } from "@/components/journal/journal-actions";
import { JournalEditor } from "@/components/journal/journal-editor";
import { loadAdjacentEntries, loadJournalEntry } from "@/features/journal/queries";
import { formatDate } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Journal entry" };

export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ctx = await getWorkspaceContext();
  const entry = await loadJournalEntry(ctx, id);
  if (!entry) notFound();
  const { older, newer } = await loadAdjacentEntries(ctx, entry);
  const label = (e: NonNullable<typeof older>) => e.title?.trim() || formatDate(e.entry_date);

  const heading = entry.title?.trim() || formatDate(entry.entry_date);

  return (
    <>
      <PageHeader
        title={heading}
        breadcrumb={[{ label: "Journal", href: `/journal?month=${entry.entry_date.slice(0, 7)}` }]}
        meta={entry.title?.trim() ? formatDate(entry.entry_date) : undefined}
        actions={<JournalActions entry={{ id: entry.id, label: heading }} afterDelete="/journal" />}
      />
      <section aria-label="Journal entry" className="max-w-3xl">
        <JournalEditor key={entry.id} entry={entry} />
      </section>
      <nav
        aria-label="Other entries"
        className="mt-10 flex max-w-3xl items-start justify-between gap-4 border-t border-border pt-4 text-sm"
      >
        {older ? (
          <Link href={`/journal/${older.id}`} className="group min-w-0">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronLeft aria-hidden className="size-3.5" />
              Older
            </span>
            <span className="block truncate group-hover:underline">{label(older)}</span>
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">This is your first entry.</span>
        )}
        {newer && (
          <Link href={`/journal/${newer.id}`} className="group min-w-0 text-right">
            <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
              Newer
              <ChevronRight aria-hidden className="size-3.5" />
            </span>
            <span className="block truncate group-hover:underline">{label(newer)}</span>
          </Link>
        )}
      </nav>
    </>
  );
}
