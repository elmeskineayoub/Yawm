import { z } from "zod";
import { optionalText, optionalUuid, requiredText } from "@/lib/form";

/** Quick capture: a title is enough. */
export const noteCaptureSchema = z.object({
  title: requiredText(200, "Give the note a title."),
  body: optionalText(20000),
});

/** Optional links to existing work. Each is independent. */
export const noteLinksSchema = z.object({
  project_id: optionalUuid,
  goal_id: optionalUuid,
  task_id: optionalUuid,
});

/** Full edit of a note's content and links. */
export const noteEditSchema = noteCaptureSchema.extend(noteLinksSchema.shape);
