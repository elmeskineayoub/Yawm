import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { IdeaActions } from "@/components/inbox/idea-actions";
import { IdeaEditForm } from "@/components/inbox/idea-edit-form";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Idea" };

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await getWorkspaceContext();
  const [idea, ideaTags] = await Promise.all([
    supabase
      .from("ideas")
      .select("id, title, body, status, converted_task_id, converted_project_id")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("idea_tags").select("tags(name)").eq("idea_id", id),
  ]);
  if (idea.error) throw new Error("Could not load the idea.");
  if (!idea.data) notFound();
  const tagNames = (ideaTags.data ?? []).flatMap((row) => (row.tags ? [row.tags.name] : []));

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted-foreground">
        <Link href="/inbox" className="hover:underline">
          Inbox
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight break-words">{idea.data.title}</h1>
      <div className="space-y-6">
        <section
          aria-label="Idea details"
          className="rounded-lg border border-border bg-surface p-5"
        >
          <IdeaEditForm idea={idea.data} tagNames={tagNames} />
        </section>
        <section
          aria-label="Idea actions"
          className="rounded-lg border border-border bg-surface p-5"
        >
          <IdeaActions idea={idea.data} afterDelete="/inbox" />
        </section>
      </div>
    </>
  );
}
