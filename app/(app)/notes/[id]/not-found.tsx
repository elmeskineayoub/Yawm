import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function NoteNotFound() {
  return (
    <EmptyState title="Note not found">
      It may have been deleted.{" "}
      <Link href="/notes" className="text-accent hover:underline">
        Back to notes
      </Link>
    </EmptyState>
  );
}
