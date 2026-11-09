import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function IdeaNotFound() {
  return (
    <EmptyState title="Idea not found">
      It may have been deleted.{" "}
      <Link href="/inbox" className="text-link">
        Back to the inbox
      </Link>
    </EmptyState>
  );
}
