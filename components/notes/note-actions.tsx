"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteNote, setNoteArchived } from "@/features/notes/actions";
import { safeAction } from "@/lib/safe-action";

type NoteActionsProps = {
  note: { id: string; title: string; archived_at: string | null };
  /** Where to go after deleting (the list, keeping its filters). */
  afterDelete: string;
};

/** Archive (with Undo) or restore, and delete after a confirmation. */
export function NoteActions({ note, afterDelete }: NoteActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const archived = note.archived_at !== null;

  const setArchived = (next: boolean) =>
    startTransition(async () => {
      const result = await safeAction(() => setNoteArchived(note.id, next));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Note archived" : "Note restored", {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await safeAction(() => setNoteArchived(note.id, !next));
            if (!undo.ok) toast.error(undo.error);
          },
        },
      });
    });

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setArchived(!archived)}>
        {archived ? (
          <ArchiveRestore aria-hidden className="size-4" />
        ) : (
          <Archive aria-hidden className="size-4" />
        )}
        {archived ? "Restore" : "Archive"}
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm" aria-label={`Delete “${note.title}”`}>
            <Trash2 aria-hidden className="size-4" />
            Delete
          </Button>
        }
        title="Delete this note?"
        description={
          <p>
            “{note.title}” will be permanently deleted. To keep it out of the way instead, archive
            it.
          </p>
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          const result = await safeAction(() => deleteNote(note.id));
          if (!result.ok) return result.error;
          toast.success("Note deleted");
          router.push(afterDelete);
          return null;
        }}
      />
    </div>
  );
}
