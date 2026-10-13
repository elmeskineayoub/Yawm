import { describe, expect, it } from "vitest";
import { csvCell, tasksToCsv, type TaskCsvInput } from "@/features/backups/csv";
import { journalToMarkdown, type JournalMdInput } from "@/features/backups/markdown";

describe("csvCell", () => {
  it("quotes only when needed and doubles embedded quotes", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(null)).toBe("");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("tasksToCsv", () => {
  const input: TaskCsvInput = {
    tasks: [
      {
        id: "t1",
        title: "Write, carefully",
        status: "todo",
        priority: "high",
        due_date: "2026-10-12",
        due_time: null,
        estimate_minutes: 30,
        project_id: "p1",
        area_id: "a1",
        description: null,
        created_at: "2026-10-01T00:00:00Z",
        completed_at: null,
      },
    ],
    projects: [{ id: "p1", name: "Launch" }],
    areas: [{ id: "a1", name: "Mental" }],
    tags: [
      { id: "g1", name: "deep work" },
      { id: "g2", name: "writing" },
    ],
    task_tags: [
      { task_id: "t1", tag_id: "g2" },
      { task_id: "t1", tag_id: "g1" },
    ],
  };

  it("writes a header and resolves project, area, and sorted tag names", () => {
    const [header, row] = tasksToCsv(input).split("\r\n");
    expect(header).toBe(
      "title,status,priority,due_date,due_time,estimate_minutes,project,area,tags,description,created_at,completed_at",
    );
    // Title has a comma → quoted; tags sorted alphabetically and comma-joined → quoted.
    expect(row).toContain('"Write, carefully"');
    expect(row).toContain("Launch");
    expect(row).toContain("Mental");
    expect(row).toContain('"deep work, writing"');
  });
});

describe("journalToMarkdown", () => {
  const input: JournalMdInput = {
    journal_entries: [
      {
        id: "e1",
        entry_date: "2026-10-10",
        title: null,
        body: "Older entry",
        mood: null,
        energy: null,
        created_at: "2026-10-10T08:00:00Z",
      },
      {
        id: "e2",
        entry_date: "2026-10-12",
        title: "Good day",
        body: "Felt focused",
        mood: 4,
        energy: 3,
        created_at: "2026-10-12T20:00:00Z",
      },
    ],
    journal_entry_tags: [{ entry_id: "e2", tag_id: "g1" }],
    tags: [{ id: "g1", name: "gratitude" }],
  };

  it("lists entries newest first with title, mood/energy, tags, and body", () => {
    const md = journalToMarkdown(input);
    expect(md.startsWith("# Journal")).toBe(true);
    // Newest (e2) appears before older (e1).
    expect(md.indexOf("Good day")).toBeLessThan(md.indexOf("Older entry"));
    expect(md).toContain("— Good day");
    expect(md).toContain("Mood: Good");
    expect(md).toContain("Energy: Moderate");
    expect(md).toContain("#gratitude");
    expect(md).toContain("Felt focused");
  });
});
