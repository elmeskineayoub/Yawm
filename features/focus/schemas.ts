import { z } from "zod";

export const focusPhaseSchema = z.enum(["focus", "short_break", "long_break"]);

/** A finished session sent from the browser to be logged. */
export const focusSessionSchema = z
  .object({
    id: z.uuid(),
    task_id: z.uuid().nullable().default(null),
    session_type: focusPhaseSchema,
    started_at: z.iso.datetime({ offset: true }),
    ended_at: z.iso.datetime({ offset: true }),
    duration_seconds: z.number().int().min(1).max(86400),
  })
  .refine((s) => Date.parse(s.ended_at) >= Date.parse(s.started_at), {
    message: "The session cannot end before it starts.",
    path: ["ended_at"],
  });

export type FocusSessionInput = z.infer<typeof focusSessionSchema>;
