import { describe, expect, it } from "vitest";
import { journalCreateSchema, journalSaveSchema } from "@/features/journal/schemas";
import { noteCaptureSchema, noteEditSchema } from "@/features/notes/schemas";

describe("note schemas", () => {
  it("captures with a title alone, body optional", () => {
    expect(noteCaptureSchema.parse({ title: "Idea log" })).toEqual({
      title: "Idea log",
      body: null,
    });
    expect(noteCaptureSchema.safeParse({ title: "  " }).success).toBe(false);
  });

  it("treats blank links as cleared and validates provided UUIDs", () => {
    const parsed = noteEditSchema.parse({
      title: "Note",
      body: "",
      project_id: "",
      goal_id: "",
      task_id: "",
    });
    expect(parsed).toEqual({
      title: "Note",
      body: null,
      project_id: null,
      goal_id: null,
      task_id: null,
    });
    expect(noteEditSchema.safeParse({ title: "x", project_id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("journal schemas", () => {
  it("requires a valid date to create an entry", () => {
    expect(journalCreateSchema.parse({ entry_date: "2026-10-12" })).toEqual({
      entry_date: "2026-10-12",
      prompt: null,
    });
    expect(journalCreateSchema.safeParse({ entry_date: "2026-13-40" }).success).toBe(false);
  });

  it("allows empty title and body while writing, and 1–5 scales", () => {
    const parsed = journalSaveSchema.parse({
      entry_date: "2026-10-12",
      title: "",
      body: "   ",
      mood: "4",
      energy: "0",
      prompt: "",
    });
    expect(parsed).toEqual({
      entry_date: "2026-10-12",
      title: null,
      body: null,
      mood: 4,
      energy: null,
      prompt: null,
    });
  });

  it("rejects out-of-range mood or energy", () => {
    expect(journalSaveSchema.safeParse({ entry_date: "2026-10-12", mood: "6" }).success).toBe(
      false,
    );
    expect(journalSaveSchema.safeParse({ entry_date: "2026-10-12", energy: "-1" }).success).toBe(
      false,
    );
  });
});
