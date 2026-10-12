import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function ProjectNotFound() {
  return (
    <EmptyState title="Project not found">
      It may have been deleted.{" "}
      <Link href="/projects" className="text-accent hover:underline">
        Back to projects
      </Link>
    </EmptyState>
  );
}
