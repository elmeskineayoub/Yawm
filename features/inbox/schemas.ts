import { z } from "zod";
import { optionalText, requiredText } from "@/lib/form";

export const ideaStatus = z.enum(["inbox", "developing", "someday", "archived"]);
export type IdeaStatus = z.infer<typeof ideaStatus>;

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  inbox: "Inbox",
  developing: "Developing",
  someday: "Someday",
  archived: "Archived",
};

export const ideaCaptureSchema = z.object({
  title: requiredText(500, "Write the idea down first."),
  body: optionalText(20000),
});

export const ideaEditSchema = ideaCaptureSchema.extend({ status: ideaStatus });
