import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { NoteActions } from "@/components/notes/note-actions";
import { NoteEditor, type NoteLinkOptions } from "@/components/notes/note-editor";
import { NotesShell, noteListState } from "@/components/notes/notes-shell";
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

export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();

  const ctx = await getWorkspaceContext();
  const note = await loadNote(ctx, id);
  if (!note) notFound();
  const options = await loadLinkOptions(ctx, note);
  const listQuery = noteListState(query).query;

  return (
    <NotesShell ctx={ctx} params={query} selectedId={note.id} selectedTitle={note.title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <p className="text-xs text-muted-foreground">
          {note.archived_at ? "Archived · " : ""}
          {[
            note.project && (
              <Link key="p" href={`/projects/${note.project.id}`} className="hover:underline">
                Project: {note.project.name}
              </Link>
            ),
            note.goal && (
              <Link key="g" href={`/goals/${note.goal.id}`} className="hover:underline">
                Goal: {note.goal.title}
              </Link>
            ),
            note.task && (
              <Link key="t" href={`/tasks/${note.task.id}`} className="hover:underline">
                Task: {note.task.title}
              </Link>
            ),
          ]
            .filter(Boolean)
            .flatMap((el, i) => (i === 0 ? [el] : [" · ", el]))}
        </p>
        <NoteActions note={note} afterDelete={`/notes${listQuery ? `?${listQuery}` : ""}`} />
      </div>
      <NoteEditor key={note.id} note={note} options={options} />
    </NotesShell>
  );
}
