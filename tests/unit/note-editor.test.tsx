import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteEditor } from "@/components/notes/note-editor";

const saveNote = vi.hoisted(() => vi.fn());
vi.mock("@/features/notes/actions", () => ({ saveNote }));

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const note = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Reading list",
  body: "Dune",
  project_id: null,
  goal_id: null,
  task_id: null,
  tags: ["books"],
};
const options = { projects: [{ id: PROJECT, name: "Library" }], goals: [], tasks: [] };

const status = () => screen.getByRole("status").textContent;
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("Note editor autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveNote.mockReset();
    saveNote.mockResolvedValue({ ok: true, data: undefined });
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });
  afterEach(() => vi.useRealTimers());

  it("saves once after a pause in typing, and says Saved only after the server confirms", async () => {
    render(<NoteEditor note={note} options={options} />);
    type("Body", "Dune, Foundation");
    await wait(300);
    type("Body", "Dune, Foundation, Hyperion");
    expect(status()).toBe("Unsaved changes…");
    await wait(500);
    expect(saveNote).not.toHaveBeenCalled();
    let resolve!: (v: unknown) => void;
    saveNote.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await wait(600);
    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(saveNote).toHaveBeenCalledWith(
      note.id,
      expect.objectContaining({ title: "Reading list", body: "Dune, Foundation, Hyperion" }),
      ["books"],
    );
    expect(status()).toBe("Saving…");
    await act(async () => resolve({ ok: true, data: undefined }));
    expect(status()).toBe("Saved");
  });

  it("does not save an empty title, and says why", async () => {
    render(<NoteEditor note={note} options={options} />);
    type("Title", "   ");
    await wait(1200);
    expect(saveNote).not.toHaveBeenCalled();
    expect(status()).toBe("Give the note a title to save it.");
  });

  it("keeps the draft and says so when the server can't be reached, then retries online", async () => {
    saveNote.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<NoteEditor note={note} options={options} />);
    type("Body", "Dune, Neuromancer");
    await wait(1200);
    expect(status()).toMatch(/wasn't saved|offline/i);
    expect((screen.getByLabelText("Body") as HTMLTextAreaElement).value).toBe("Dune, Neuromancer");
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(saveNote).toHaveBeenCalledTimes(2);
    expect(status()).toBe("Saved");
  });

  it("doesn't try to save while the browser is offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    render(<NoteEditor note={note} options={options} />);
    type("Body", "Offline draft");
    await wait(1200);
    expect(saveNote).not.toHaveBeenCalled();
    expect(status()).toBe("Offline — not saved yet");
  });

  it("saves links and tags the same way", async () => {
    render(<NoteEditor note={note} options={options} />);
    fireEvent.change(screen.getByLabelText("Project"), { target: { value: PROJECT } });
    type("Tags", "books, sci-fi, Books");
    await wait(1200);
    expect(saveNote).toHaveBeenCalledWith(
      note.id,
      expect.objectContaining({ project_id: PROJECT }),
      ["books", "sci-fi"],
    );
  });

  it("ignores whitespace-only changes", async () => {
    render(<NoteEditor note={note} options={options} />);
    type("Body", "Dune   ");
    await wait(1200);
    expect(saveNote).not.toHaveBeenCalled();
  });

  it("asks before leaving with unsaved changes", async () => {
    render(<NoteEditor note={note} options={options} />);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    type("Body", "Dune and more");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
