"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteEntry } from "@/features/journal/actions";

export function JournalActions({
  entry,
  afterDelete,
}: {
  entry: { id: string; label: string };
  afterDelete?: string;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" className="px-2 py-1 text-xs" aria-label={`Delete ${entry.label}`}>
          Delete
        </Button>
      }
      title="Delete this entry?"
      description={<p>This journal entry will be permanently deleted. This cannot be undone.</p>}
      confirmLabel="Delete"
      onConfirm={async () => {
        const result = await deleteEntry(entry.id);
        if (!result.ok) return result.error;
        if (afterDelete) router.push(afterDelete);
        return null;
      }}
    />
  );
}
