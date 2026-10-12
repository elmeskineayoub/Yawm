import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { optionalDate, optionalText, optionalUuid, requiredText } from "@/lib/form";

const optionalNumber = (max: number) =>
  z.preprocess(
    (value) =>
      value === undefined || value === null || (typeof value === "string" && value.trim() === "")
        ? null
        : Number(value),
    z.number().gt(0, "Use a number above 0.").max(max, "That number is too large.").nullable(),
  );

/** Mirrors the habits table's checks so errors appear next to the right field. */
export const habitSchema = z
  .object({
    title: requiredText(200, "Name the habit."),
    description: optionalText(2000),
    area_id: optionalUuid,
    kind: z.enum(["boolean", "measurable"]).default("boolean"),
    target_value: optionalNumber(1_000_000),
    unit: optionalText(30),
    frequency: z.enum(["daily", "weekly"]).default("daily"),
    weekdays: z
      .array(z.coerce.number().int().min(1).max(7))
      .min(1, "Pick at least one day.")
      .max(7)
      .default([1, 2, 3, 4, 5, 6, 7]),
    times_per_week: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? null : Number(value)),
      z.number().int().min(1).max(7).nullable(),
    ),
    starts_on: z.string().refine(isIsoDate, "Enter a valid date."),
    ends_on: optionalDate,
  })
  .superRefine((h, ctx) => {
    if (h.kind === "measurable" && h.target_value === null) {
      ctx.addIssue({ code: "custom", path: ["target_value"], message: "Set a daily target." });
    }
    if (h.frequency === "weekly" && h.times_per_week === null) {
      ctx.addIssue({ code: "custom", path: ["times_per_week"], message: "How many times a week?" });
    }
    if (h.ends_on && h.ends_on < h.starts_on) {
      ctx.addIssue({ code: "custom", path: ["ends_on"], message: "End after the start date." });
    }
  })
  .transform((h) => ({
    ...h,
    weekdays: [...new Set(h.weekdays)].sort(),
    // Clear fields that don't apply, so the database checks always hold.
    target_value: h.kind === "measurable" ? h.target_value : null,
    unit: h.kind === "measurable" ? h.unit : null,
    times_per_week: h.frequency === "weekly" ? h.times_per_week : null,
  }));

export type HabitInput = z.output<typeof habitSchema>;

/** What to record for a day: done (1), an amount, a rest day, or nothing (clear). */
export const logEntrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("value"), value: z.number().min(0).max(1_000_000) }),
  z.object({ type: z.literal("rest") }),
  z.object({ type: z.literal("clear") }),
]);

export type LogEntry = z.infer<typeof logEntrySchema>;
