import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import { NotesShell } from "@/components/notes/notes-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, ctx] = await Promise.all([searchParams, getWorkspaceContext()]);
  return (
    <NotesShell ctx={ctx} params={params} selectedId={null}>
      <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
        <NotebookPen aria-hidden className="size-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Choose a note, or start a new one</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          For text you want to keep that isn&apos;t a task or a dated journal entry. Notes save as
          you type.
        </p>
      </div>
    </NotesShell>
  );
}
