import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { optionalText } from "@/lib/form";

/** A 1–5 scale or null; accepts "" / "0" (from a select) as "not recorded". */
const optionalScale = z.preprocess(
  (value) =>
    value === undefined ||
    value === null ||
    value === "" ||
    value === "0" ||
    (typeof value === "string" && value.trim() === "")
      ? null
      : Number(value),
  z.number().int().min(1, "Choose 1–5.").max(5, "Choose 1–5.").nullable(),
);

export const entryDateSchema = z.string().refine(isIsoDate, "Enter a valid date.");

/** Creating an entry: a date is required; a prompt may seed the body. */
export const journalCreateSchema = z.object({
  entry_date: entryDateSchema,
  prompt: optionalText(500),
});

/** Autosaved fields of an entry. Title and body may be empty while writing. */
export const journalSaveSchema = z.object({
  entry_date: entryDateSchema,
  title: optionalText(200),
  body: optionalText(20000),
  mood: optionalScale,
  energy: optionalScale,
  prompt: optionalText(500),
});

export type JournalSaveInput = z.infer<typeof journalSaveSchema>;
