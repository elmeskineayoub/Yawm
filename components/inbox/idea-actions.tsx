"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  FolderKanban,
  ListTodo,
  MoreHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { convertIdea, deleteIdea, setIdeaStatus } from "@/features/inbox/actions";
import { IDEA_STATUS_LABELS, type IdeaStatus } from "@/features/inbox/schemas";
import { safeAction } from "@/lib/safe-action";
import { cn } from "@/lib/utils";

type IdeaActionsProps = {
  idea: {
    id: string;
    title: string;
    status: IdeaStatus;
    converted_task_id: string | null;
    converted_project_id: string | null;
    converted_goal_id: string | null;
  };
  /** Where to go after deleting (the idea's own page); lists just refresh. */
  afterDelete?: string;
  /** Always show the buttons (the idea page); in lists they appear on hover or focus. */
  visible?: boolean;
};

const TARGETS = [
  { target: "task", label: "Task", icon: ListTodo, href: "/tasks/", field: "converted_task_id" },
  {
    target: "project",
    label: "Project",
    icon: FolderKanban,
    href: "/projects/",
    field: "converted_project_id",
  },
  { target: "goal", label: "Goal", icon: Star, href: "/goals/", field: "converted_goal_id" },
] as const;

const iconButton = (visible: boolean) =>
  cn(
    "inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-opacity duration-150 hover:bg-surface-muted hover:text-foreground disabled:opacity-50",
    !visible &&
      "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
  );

/**
 * An idea's actions, kept short: one Convert menu (task, project, or goal; the idea is kept in
 * Archived), Archive with Undo, and a More menu for moving between statuses and deleting.
 */
export function IdeaActions({ idea, afterDelete, visible = false }: IdeaActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // When the More menu closes to open the delete dialog, the menu must not pull focus back to
  // its trigger: the dialog's focus trap and the menu's would fight over it.
  const openingDialog = useRef(false);
  const archived = idea.status === "archived";

  const convert = (target: "task" | "project" | "goal") =>
    startTransition(async () => {
      const result = await safeAction(() => convertIdea(idea.id, target));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Converted to a ${target}. The original idea is kept in Archived.`);
      router.push(result.data.href);
    });

  const move = (next: IdeaStatus) =>
    startTransition(async () => {
      if (next === idea.status) return;
      const previous = idea.status;
      const result = await safeAction(() => setIdeaStatus(idea.id, next));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        next === "archived" ? "Idea archived" : `Moved to ${IDEA_STATUS_LABELS[next]}`,
        {
          action: {
            label: "Undo",
            onClick: async () => {
              const undo = await safeAction(() => setIdeaStatus(idea.id, previous));
              if (!undo.ok) toast.error(undo.error);
            },
          },
        },
      );
    });

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            disabled={pending}
            aria-label={`Convert “${idea.title}”`}
            className={iconButton(visible)}
          >
            <ArrowRight aria-hidden className="size-3.5" />
            Convert
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuLabel>Turn into</MenuLabel>
          {TARGETS.map((t) => {
            const existing = idea[t.field];
            return existing ? (
              <MenuItem key={t.target} onSelect={() => router.push(`${t.href}${existing}`)}>
                <t.icon aria-hidden />
                Open {t.label.toLowerCase()}
              </MenuItem>
            ) : (
              <MenuItem
                key={t.target}
                aria-label={`Convert “${idea.title}” to a ${t.target}`}
                onSelect={() => convert(t.target)}
              >
                <t.icon aria-hidden />
                {t.label}
              </MenuItem>
            );
          })}
        </MenuContent>
      </Menu>
      <button
        type="button"
        disabled={pending}
        aria-label={archived ? `Restore “${idea.title}” to the Inbox` : `Archive “${idea.title}”`}
        title={archived ? "Restore to Inbox" : "Archive"}
        onClick={() => move(archived ? "inbox" : "archived")}
        className={iconButton(visible)}
      >
        {archived ? (
          <ArchiveRestore aria-hidden className="size-4" />
        ) : (
          <Archive aria-hidden className="size-4" />
        )}
      </button>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            disabled={pending}
            aria-label={`More actions for “${idea.title}”`}
            className={iconButton(visible)}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent
          align="end"
          onCloseAutoFocus={(e) => {
            if (openingDialog.current) {
              e.preventDefault();
              openingDialog.current = false;
            }
          }}
        >
          <MenuLabel>Move to</MenuLabel>
          <MenuRadioGroup value={idea.status} onValueChange={(v) => move(v as IdeaStatus)}>
            {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((s) => (
              <MenuRadioItem key={s} value={s}>
                {IDEA_STATUS_LABELS[s]}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem
            tone="danger"
            onSelect={() => {
              openingDialog.current = true;
              // Open once the menu has closed, so only one focus trap is active at a time.
              window.setTimeout(() => setConfirmDelete(true), 0);
            }}
          >
            <Trash2 aria-hidden />
            Delete…
          </MenuItem>
        </MenuContent>
      </Menu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this idea?"
        description={
          <p>
            “{idea.title}” will be permanently deleted. Tasks, projects, or goals made from it are
            kept. To keep it out of the way instead, archive it.
          </p>
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          const result = await safeAction(() => deleteIdea(idea.id));
          if (!result.ok) return result.error;
          toast.success("Idea deleted");
          if (afterDelete) router.push(afterDelete);
          return null;
        }}
      />
    </div>
  );
}
