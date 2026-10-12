import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { NoteActions } from "@/components/notes/note-actions";
import { NoteEditForm, type NoteLinkOptions } from "@/components/notes/note-edit-form";
import { loadNote } from "@/features/notes/queries";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Note" };

/** Link pickers: projects and goals that aren't archived, plus recent open tasks. */
async function loadLinkOptions(
  ctx: Awaited<ReturnType<typeof getWorkspaceContext>>,
  current: { project_id: string | null; goal_id: string | null; task_id: string | null },
): Promise<NoteLinkOptions> {
  const { supabase, workspace } = ctx;
  const [projects, goals, tasks] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .neq("status", "archived")
      .order("name")
      .limit(500),
    supabase
      .from("goals")
      .select("id, title")
      .eq("workspace_id", workspace.id)
      .neq("status", "archived")
      .order("title")
      .limit(500),
    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("workspace_id", workspace.id)
      .in("status", ["todo", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (projects.error || goals.error || tasks.error) throw new Error("Could not load link options.");

  // Keep the currently linked record selectable even if it is archived/completed (outside the lists).
  const ensure = async <T extends { id: string }>(
    list: T[],
    id: string | null,
    fetchOne: () => Promise<T | null>,
  ): Promise<T[]> => {
    if (!id || list.some((row) => row.id === id)) return list;
    const extra = await fetchOne();
    return extra ? [extra, ...list] : list;
  };

  return {
    projects: await ensure(projects.data, current.project_id, async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", current.project_id!)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      return data;
    }),
    goals: await ensure(goals.data, current.goal_id, async () => {
      const { data } = await supabase
        .from("goals")
        .select("id, title")
        .eq("id", current.goal_id!)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      return data;
    }),
    tasks: await ensure(
      tasks.data.map(({ id, title }) => ({ id, title })),
      current.task_id,
      async () => {
        const { data } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("id", current.task_id!)
          .eq("workspace_id", workspace.id)
          .maybeSingle();
        return data;
      },
    ),
  };
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ctx = await getWorkspaceContext();
  const note = await loadNote(ctx, id);
  if (!note) notFound();
  const options = await loadLinkOptions(ctx, note);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted-foreground">
        <Link href="/notes" className="hover:underline">
          Notes
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight break-words">
        {note.title}
        {note.archived_at && (
          <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
            Archived
          </span>
        )}
      </h1>
      <div className="space-y-6">
        <section
          aria-label="Note details"
          className="rounded-lg border border-border bg-surface p-5"
        >
          <NoteEditForm note={note} tagNames={note.tags} options={options} />
        </section>
        {(note.project || note.goal || note.task) && (
          <section
            aria-label="Linked work"
            className="rounded-lg border border-border bg-surface p-5 text-sm"
          >
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Linked to
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {note.project && (
                <li>
                  <Link
                    href={`/projects/${note.project.id}`}
                    className="text-accent hover:underline"
                  >
                    Project: {note.project.name}
                  </Link>
                </li>
              )}
              {note.goal && (
                <li>
                  <Link href={`/goals/${note.goal.id}`} className="text-accent hover:underline">
                    Goal: {note.goal.title}
                  </Link>
                </li>
              )}
              {note.task && (
                <li>
                  <Link href={`/tasks/${note.task.id}`} className="text-accent hover:underline">
                    Task: {note.task.title}
                  </Link>
                </li>
              )}
            </ul>
          </section>
        )}
        <section
          aria-label="Note actions"
          className="rounded-lg border border-border bg-surface p-5"
        >
          <NoteActions note={note} afterDelete="/notes" />
        </section>
      </div>
    </>
  );
}
