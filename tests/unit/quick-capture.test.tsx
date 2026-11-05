import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickCaptureButton, QuickCaptureProvider } from "@/components/shared/quick-capture";
import { CAPTURE_DRAFT_KEY, parseDraft } from "@/lib/capture-draft";

const actions = vi.hoisted(() => ({ createIdea: vi.fn(), createTask: vi.fn() }));
vi.mock("@/features/inbox/actions", () => ({ createIdea: actions.createIdea }));
vi.mock("@/features/tasks/actions", () => ({ createTask: actions.createTask }));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const TODAY = "2026-11-05";
function setup() {
  return render(
    <QuickCaptureProvider today={TODAY}>
      <QuickCaptureButton />
      <QuickCaptureButton variant="tab" />
    </QuickCaptureProvider>,
  );
}
const openCapture = async () => {
  await userEvent.click(screen.getAllByRole("button", { name: "Quick capture" })[0]!);
  return screen.findByRole("dialog", { name: "Quick capture" });
};
const fd = (call: unknown[]) => Object.fromEntries((call[0] as FormData).entries());

describe("Quick capture", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    actions.createIdea.mockResolvedValue({ ok: true, data: { id: "i1" } });
    actions.createTask.mockResolvedValue({ ok: true, data: { id: "t1" } });
  });

  it("opens one shared dialog from any trigger, and with q once", async () => {
    setup();
    // Both the sidebar and the tab-bar buttons are named "Quick capture"; use the tab-bar one.
    await userEvent.click(screen.getAllByRole("button", { name: "Quick capture" })[1]!);
    expect(screen.getAllByRole("dialog", { name: "Quick capture" })).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("q");
    expect(screen.getAllByRole("dialog", { name: "Quick capture" })).toHaveLength(1);
  });

  it("does not open with q while typing in a field", async () => {
    render(
      <QuickCaptureProvider>
        <input aria-label="Elsewhere" />
      </QuickCaptureProvider>,
    );
    await userEvent.click(screen.getByLabelText("Elsewhere"));
    await userEvent.keyboard("q");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saves an idea with Enter and closes only after the server confirms", async () => {
    setup();
    await openCapture();
    await userEvent.type(
      screen.getByPlaceholderText("What's on your mind?"),
      "Launch a newsletter{Enter}",
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fd(actions.createIdea.mock.calls[0]!)).toMatchObject({ title: "Launch a newsletter" });
    expect(toast.success).toHaveBeenCalledWith("Saved to Inbox");
    expect(window.sessionStorage.getItem(CAPTURE_DRAFT_KEY)).toBeNull();
  });

  it("keeps the text and shows the error when the server rejects it", async () => {
    actions.createIdea.mockResolvedValue({
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is too long."] },
    });
    setup();
    await openCapture();
    await userEvent.type(screen.getByPlaceholderText("What's on your mind?"), "Too long{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is too long.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What's on your mind?")).toHaveValue("Too long");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("never claims a save when the request fails, and keeps the draft", async () => {
    actions.createIdea.mockRejectedValue(new TypeError("Failed to fetch"));
    setup();
    await openCapture();
    await userEvent.type(
      screen.getByPlaceholderText("What's on your mind?"),
      "Offline thought{Enter}",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("wasn't saved");
    expect(toast.success).not.toHaveBeenCalled();
    expect(parseDraft(window.sessionStorage.getItem(CAPTURE_DRAFT_KEY)).title).toBe(
      "Offline thought",
    );
  });

  it("restores a draft after closing with Escape, and Discard clears it", async () => {
    setup();
    await openCapture();
    await userEvent.type(screen.getByPlaceholderText("What's on your mind?"), "Half a thought");
    await userEvent.keyboard("{Escape}");
    await openCapture();
    expect(screen.getByPlaceholderText("What's on your mind?")).toHaveValue("Half a thought");
    expect(screen.getByRole("status")).toHaveTextContent("Draft restored");
    // "Clear" empties the draft and keeps the dialog open for a fresh start.
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByPlaceholderText("What's on your mind?")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    // With text, the footer button reads "Discard": it clears the draft and closes.
    await userEvent.type(screen.getByPlaceholderText("What's on your mind?"), "Another");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(CAPTURE_DRAFT_KEY)).toBeNull();
  });

  it("captures a task due tomorrow and keeps the dialog open with Add another", async () => {
    setup();
    await openCapture();
    await userEvent.click(screen.getByRole("button", { name: "Task" }));
    await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-11-06");
    await userEvent.click(screen.getByRole("checkbox", { name: "Add another" }));
    await userEvent.type(screen.getByPlaceholderText("What needs doing?"), "Book dentist{Enter}");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Task added"));
    expect(fd(actions.createTask.mock.calls[0]!)).toMatchObject({
      title: "Book dentist",
      due_date: "2026-11-06",
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What needs doing?")).toHaveValue("");
    expect(screen.getByPlaceholderText("What needs doing?")).toHaveFocus();
  });
});

describe("parseDraft", () => {
  it("accepts a stored draft and rejects tampered values", () => {
    expect(
      parseDraft(JSON.stringify({ kind: "task", title: "x", body: "", due: "2026-11-05" })),
    ).toEqual({
      kind: "task",
      title: "x",
      body: "",
      due: "2026-11-05",
    });
    expect(parseDraft("not json").title).toBe("");
    expect(parseDraft(JSON.stringify({ kind: "evil", title: 5, due: "tomorrow" }))).toEqual({
      kind: "idea",
      title: "",
      body: "",
      due: "",
    });
  });
});
