import { z } from "zod";
import { fieldErrorsOf } from "@/lib/form";
import type { Tables } from "@/lib/db/types";
import { taskEditSchema, type TaskEditInput } from "./schemas";

/**
 * Field-by-field task editing (the task detail autosaves each field). A patch is merged into the
 * stored row and the result validated with the same taskEditSchema the full form used, so every
 * cross-field rule applies to a single-field change too.
 */

/** Fields a client may change, in the string shape a form submits. */
export const taskPatchSchema = z
  .object({
    title: z.string().max(1000),
    description: z.string().max(40000),
    status: z.string(),
    priority: z.string(),
    due_date: z.string(),
    due_time: z.string(),
    estimate_minutes: z.string(),
    project_id: z.string(),
    area_id: z.string(),
    recurrence_frequency: z.string(),
    recurrence_interval: z.string(),
    recurrence_until: z.string(),
    recurrence_weekdays: z.array(z.string()).max(7),
  })
  .partial()
  .strict();
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export const PATCH_SOURCE_COLUMNS =
  "title, description, status, priority, due_date, due_time, estimate_minutes, project_id, area_id, recurrence_frequency, recurrence_interval, recurrence_until, recurrence_weekdays" as const;

export type PatchSourceRow = Pick<
  Tables["tasks"]["Row"],
  | "title"
  | "description"
  | "status"
  | "priority"
  | "due_date"
  | "due_time"
  | "estimate_minutes"
  | "project_id"
  | "area_id"
  | "recurrence_frequency"
  | "recurrence_interval"
  | "recurrence_until"
  | "recurrence_weekdays"
>;

export type MergeResult =
  | { ok: true; data: TaskEditInput }
  | { ok: false; error: string; fieldErrors: Partial<Record<string, string[]>> };

/** Validates `patch` against the stored task. Unknown fields or malformed input are rejected. */
export function mergeTaskPatch(row: PatchSourceRow, patch: unknown): MergeResult {
  const parsedPatch = taskPatchSchema.safeParse(patch);
  if (!parsedPatch.success) return { ok: false, error: "Invalid change.", fieldErrors: {} };

  const merged = {
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    priority: row.priority,
    due_date: row.due_date ?? "",
    due_time: row.due_time?.slice(0, 5) ?? "",
    estimate_minutes: row.estimate_minutes?.toString() ?? "",
    project_id: row.project_id ?? "",
    area_id: row.area_id ?? "",
    recurrence_frequency: row.recurrence_frequency ?? "none",
    recurrence_interval: String(row.recurrence_interval),
    recurrence_until: row.recurrence_until ?? "",
    recurrence_weekdays: (row.recurrence_weekdays ?? []).map(String),
    ...parsedPatch.data,
  };
  const parsed = taskEditSchema.safeParse(merged);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    const first = Object.values(fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Check this field.", fieldErrors };
  }
  return { ok: true, data: parsed.data };
}
