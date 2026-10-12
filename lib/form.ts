import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

/**
 * Empty or absent form inputs become null, so optional columns are cleared rather than set to ""
 * and forms may omit fields they don't use.
 */
const blankToNull = (value: unknown) =>
  value === undefined || (typeof value === "string" && value.trim() === "") ? null : value;

export const optionalText = (max: number) =>
  z.preprocess(
    blankToNull,
    z.string().trim().max(max, `Use at most ${max} characters.`).nullable(),
  );

export const requiredText = (max: number, message = "This field is required.") =>
  z.string().trim().min(1, message).max(max, `Use at most ${max} characters.`);

export const optionalDate = z.preprocess(
  blankToNull,
  z.string().refine(isIsoDate, "Enter a valid date.").nullable(),
);

export const optionalUuid = z.preprocess(blankToNull, z.uuid().nullable());

export const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (value) => (blankToNull(value) === null ? null : Number(value)),
    z.number().int().min(min).max(max).nullable(),
  );

/** Splits "a, b ,c" into trimmed, de-duplicated names. */
export function parseTagNames(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of value.split(",")) {
    const name = raw.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      names.push(name);
    }
  }
  return names;
}

export function formObject(formData: FormData, keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, formData.get(key) ?? undefined]));
}

export function fieldErrorsOf(error: z.ZodError): Partial<Record<string, string[]>> {
  return z.flattenError(error).fieldErrors as Partial<Record<string, string[]>>;
}
