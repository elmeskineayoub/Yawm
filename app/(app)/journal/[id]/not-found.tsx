import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function JournalEntryNotFound() {
  return (
    <EmptyState title="Entry not found">
      It may have been deleted.{" "}
      <Link href="/journal" className="text-accent hover:underline">
        Back to the journal
      </Link>
    </EmptyState>
  );
}
