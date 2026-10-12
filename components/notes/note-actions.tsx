"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteNote, setNoteArchived } from "@/features/notes/actions";

type NoteActionsProps = {
  note: { id: string; title: string; archived_at: string | null };
  afterDelete?: string;
};

export function NoteActions({ note, afterDelete }: NoteActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const archived = note.archived_at !== null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="secondary"
        className="px-2 py-1 text-xs"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setNoteArchived(note.id, !archived);
            if (!result.ok) toast.error(result.error);
            else toast.success(archived ? "Note restored" : "Note archived");
          })
        }
      >
        {archived ? "Restore" : "Archive"}
      </Button>
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            aria-label={`Delete “${note.title}”`}
          >
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
          const result = await deleteNote(note.id);
          if (!result.ok) return result.error;
          if (afterDelete) router.push(afterDelete);
          return null;
        }}
      />
    </div>
  );
}
