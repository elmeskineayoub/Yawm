import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type Named = { id: string; name: string };

export type TaskCsvInput = {
  tasks: readonly Pick<
    TaskRow,
    | "id"
    | "title"
    | "status"
    | "priority"
    | "due_date"
    | "due_time"
    | "estimate_minutes"
    | "project_id"
    | "area_id"
    | "description"
    | "created_at"
    | "completed_at"
  >[];
  projects: readonly Named[];
  areas: readonly Named[];
  tags: readonly Named[];
  task_tags: readonly { task_id: string; tag_id: string }[];
};

/** Quotes a CSV cell when it contains a comma, quote, or newline; doubles embedded quotes. */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: readonly (string | number | null)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const TASK_HEADER = [
  "title",
  "status",
  "priority",
  "due_date",
  "due_time",
  "estimate_minutes",
  "project",
  "area",
  "tags",
  "description",
  "created_at",
  "completed_at",
] as const;

/** Tasks as a spreadsheet-friendly CSV (REQUIREMENTS 8.6), with names resolved from the bundle. */
export function tasksToCsv(records: TaskCsvInput): string {
  const projectName = new Map(records.projects.map((p) => [p.id, p.name]));
  const areaName = new Map(records.areas.map((a) => [a.id, a.name]));
  const tagName = new Map(records.tags.map((t) => [t.id, t.name]));
  const tagsByTask = new Map<string, string[]>();
  for (const { task_id, tag_id } of records.task_tags) {
    const name = tagName.get(tag_id);
    if (name) tagsByTask.set(task_id, [...(tagsByTask.get(task_id) ?? []), name]);
  }

  const rows: (string | number | null)[][] = [[...TASK_HEADER]];
  for (const t of records.tasks) {
    rows.push([
      t.title,
      t.status,
      t.priority,
      t.due_date,
      t.due_time,
      t.estimate_minutes,
      t.project_id ? (projectName.get(t.project_id) ?? "") : "",
      t.area_id ? (areaName.get(t.area_id) ?? "") : "",
      (tagsByTask.get(t.id) ?? []).sort((a, b) => a.localeCompare(b)).join(", "),
      t.description,
      t.created_at,
      t.completed_at,
    ]);
  }
  return toCsv(rows);
}
