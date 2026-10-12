import { z } from "zod";
import { optionalDate, optionalInt, optionalText, optionalUuid, requiredText } from "@/lib/form";

export const taskStatus = z.enum(["todo", "in_progress", "done", "cancelled"]);
export const taskPriority = z.enum(["low", "medium", "high", "urgent"]);

const dueTime = z.preprocess(
  (value) =>
    value === undefined || (typeof value === "string" && value.trim() === "") ? null : value,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Enter a valid time.")
    .nullable(),
);

export const quickTaskSchema = z.object({
  title: requiredText(500, "Give the task a title."),
  due_date: optionalDate,
  priority: taskPriority.default("medium"),
  project_id: optionalUuid,
  parent_task_id: optionalUuid,
});

export const taskEditSchema = z
  .object({
    title: requiredText(500, "Give the task a title."),
    description: optionalText(20000),
    status: taskStatus,
    priority: taskPriority,
    due_date: optionalDate,
    due_time: dueTime,
    estimate_minutes: optionalInt(1, 10080),
    project_id: optionalUuid,
    area_id: optionalUuid,
    recurrence_frequency: z.preprocess(
      (value) => (value === undefined || value === "" || value === "none" ? null : value),
      z.enum(["daily", "weekly", "monthly"]).nullable(),
    ),
    recurrence_interval: optionalInt(1, 365),
    recurrence_weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7),
    recurrence_until: optionalDate,
  })
  .superRefine((task, ctx) => {
    if (task.due_time && !task.due_date) {
      ctx.addIssue({ code: "custom", path: ["due_time"], message: "Add a due date first." });
    }
    if (task.recurrence_frequency && !task.due_date) {
      ctx.addIssue({
        code: "custom",
        path: ["recurrence_frequency"],
        message: "Recurring tasks need a due date to repeat from.",
      });
    }
    if (task.recurrence_until && task.due_date && task.recurrence_until < task.due_date) {
      ctx.addIssue({
        code: "custom",
        path: ["recurrence_until"],
        message: "The end date must be on or after the due date.",
      });
    }
  })
  .transform((task) => ({
    ...task,
    recurrence_interval: task.recurrence_interval ?? 1,
    // Weekdays only apply to weekly rules; an empty selection means "same weekday each week".
    recurrence_weekdays:
      task.recurrence_frequency === "weekly" && task.recurrence_weekdays.length > 0
        ? [...new Set(task.recurrence_weekdays)].sort()
        : null,
    recurrence_until: task.recurrence_frequency ? task.recurrence_until : null,
  }));

export type TaskEditInput = z.infer<typeof taskEditSchema>;
