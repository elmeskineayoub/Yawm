import { z } from "zod";
import { optionalText, optionalUuid, requiredText } from "@/lib/form";

const instant = z.iso.datetime({ offset: true, message: "Enter a valid time." });

export const MAX_BLOCK_MINUTES = 24 * 60;

export const blockInputSchema = z
  .object({
    title: requiredText(200, "Give the block a title."),
    notes: optionalText(5000),
    starts_at: instant,
    ends_at: instant,
    task_id: optionalUuid,
    project_id: optionalUuid,
  })
  .superRefine((block, ctx) => {
    const minutes = (Date.parse(block.ends_at) - Date.parse(block.starts_at)) / 60_000;
    if (!(minutes > 0)) {
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "End must be after the start." });
    } else if (minutes > MAX_BLOCK_MINUTES) {
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "A block can be at most 24 hours.",
      });
    }
  });

export type BlockInput = z.infer<typeof blockInputSchema>;

/** Moving or resizing only changes the times. */
export const blockTimesSchema = z.object({ starts_at: instant, ends_at: instant }).refine((b) => {
  const minutes = (Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000;
  return minutes > 0 && minutes <= MAX_BLOCK_MINUTES;
}, "A block must end after it starts and last at most 24 hours.");
