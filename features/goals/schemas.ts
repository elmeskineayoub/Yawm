import { z } from "zod";
import { optionalDate, optionalText, optionalUuid, requiredText } from "@/lib/form";

export const goalStatusSchema = z.enum(["active", "paused", "achieved", "archived"]);

const optionalAmount = (min: number, minMessage: string) =>
  z.preprocess(
    (value) =>
      value === undefined || value === null || (typeof value === "string" && value.trim() === "")
        ? null
        : Number(value),
    z.number().min(min, minMessage).max(1e12, "That number is too large.").nullable(),
  );

export const goalTitleSchema = requiredText(200, "Name the goal.");

/** Inline-edited text fields. */
export const goalTextSchemas = {
  title: goalTitleSchema,
  why: optionalText(2000),
  description: optionalText(5000),
} as const;

/** Area, dates, and the optional measurable target; mirrors the goals table's checks. */
export const goalDetailsSchema = z
  .object({
    area_id: optionalUuid,
    start_date: optionalDate,
    target_date: optionalDate,
    target_value: optionalAmount(0.01, "Use a target above 0."),
    current_value: optionalAmount(0, "Use 0 or more."),
    unit: optionalText(30),
  })
  .superRefine((g, ctx) => {
    if (g.start_date && g.target_date && g.target_date < g.start_date) {
      ctx.addIssue({ code: "custom", path: ["target_date"], message: "End after the start date." });
    }
  })
  .transform((g) =>
    // Without a target, a current value or unit means nothing: clear them.
    g.target_value === null ? { ...g, current_value: null, unit: null } : g,
  );

export const milestoneTitleSchema = requiredText(200, "Name the milestone.");
