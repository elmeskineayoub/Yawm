import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { notFound } from "next/navigation";
import { z } from "zod";
import { IdeaActions } from "@/components/inbox/idea-actions";
import { IdeaEditForm } from "@/components/inbox/idea-edit-form";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Idea" };

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, workspace } = await getWorkspaceContext();
  const [idea, ideaTags] = await Promise.all([
    supabase
      .from("ideas")
      .select("id, title, body, status, converted_task_id, converted_project_id, converted_goal_id")
      .eq("id", id)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    supabase.from("idea_tags").select("tags(name)").eq("idea_id", id),
  ]);
  if (idea.error) throw new Error("Could not load the idea.");
  if (!idea.data) notFound();
  const tagNames = (ideaTags.data ?? []).flatMap((row) => (row.tags ? [row.tags.name] : []));

  return (
    <>
      <PageHeader
        title={idea.data.title}
        breadcrumb={[{ label: "Inbox", href: "/inbox" }]}
        actions={<IdeaActions idea={idea.data} afterDelete="/inbox" visible />}
      />
      <section aria-label="Idea details" className="max-w-3xl">
        <IdeaEditForm idea={idea.data} tagNames={tagNames} />
      </section>
    </>
  );
}
