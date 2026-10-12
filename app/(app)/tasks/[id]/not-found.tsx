import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function TaskNotFound() {
  return (
    <EmptyState title="Task not found">
      It may have been deleted, or it belongs to a workspace you can&apos;t access.{" "}
      <Link href="/tasks" className="text-accent hover:underline">
        Back to tasks
      </Link>
    </EmptyState>
  );
}
