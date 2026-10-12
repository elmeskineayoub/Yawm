import { z } from "zod";
import { optionalDate, optionalText, optionalUuid, requiredText } from "@/lib/form";

export const projectStatus = z.enum(["planned", "active", "on_hold", "completed", "archived"]);
export type ProjectStatus = z.infer<typeof projectStatus>;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

export const PROJECT_STATUSES = projectStatus.options;

const dates = <T extends { start_date: string | null; due_date: string | null }>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  if (value.start_date && value.due_date && value.due_date < value.start_date) {
    ctx.addIssue({ code: "custom", path: ["due_date"], message: "Due date is before the start." });
  }
};

export const projectCreateSchema = z
  .object({
    name: requiredText(200, "Name the project."),
    area_id: optionalUuid,
    status: projectStatus.default("active"),
    start_date: optionalDate,
    due_date: optionalDate,
  })
  .superRefine(dates);

export const projectEditSchema = z
  .object({
    name: requiredText(200, "Name the project."),
    description: optionalText(5000),
    notes: optionalText(20000),
    area_id: optionalUuid,
    status: projectStatus,
    start_date: optionalDate,
    due_date: optionalDate,
  })
  .superRefine(dates);
