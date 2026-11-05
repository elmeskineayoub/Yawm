import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TaskProperties,
  TaskSaveIndicator,
  TaskSaveProvider,
  TaskTitleField,
  type TaskPropertiesProps,
} from "@/components/tasks/task-editor";

const actions = vi.hoisted(() => ({ updateTaskFields: vi.fn(), setTaskTags: vi.fn() }));
vi.mock("@/features/tasks/actions", () => actions);
vi.mock("@/features/goals/actions", () => ({ linkToGoal: vi.fn() }));

const props: TaskPropertiesProps = {
  taskId: "t1",
  status: "todo",
  priority: "medium",
  dueDate: null,
  dueTime: null,
  estimateMinutes: null,
  projectId: null,
  areaId: null,
  goalId: null,
  tagNames: [],
  projects: [],
  areas: [],
  goals: [],
  tagSuggestions: [],
  showGoal: false,
};

function setup(overrides: Partial<TaskPropertiesProps> = {}) {
  return render(
    <TaskSaveProvider>
      <TaskSaveIndicator />
      <TaskTitleField taskId="t1" title="Write first issue" />
      <TaskProperties {...props} {...overrides} />
    </TaskSaveProvider>,
  );
}

describe("Task editor autosave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.updateTaskFields.mockResolvedValue({ ok: true });
    actions.setTaskTags.mockResolvedValue({ ok: true });
  });

  it("saves a picker on change and reports Saved only after the server confirms", async () => {
    let resolve!: (v: { ok: true }) => void;
    actions.updateTaskFields.mockImplementation(() => new Promise((r) => (resolve = r)));
    setup();
    await userEvent.selectOptions(screen.getByLabelText("Priority"), "high");
    expect(actions.updateTaskFields).toHaveBeenCalledWith("t1", { priority: "high" });
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
    await act(async () => resolve({ ok: true }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("rolls the field back and explains when the server rejects the change", async () => {
    actions.updateTaskFields.mockResolvedValue({ ok: false, error: "Add a due date first." });
    setup({ dueDate: "2026-11-10", dueTime: "09:30:00" });
    const due = screen.getByLabelText("Due date");
    await userEvent.clear(due);
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a due date first.");
    expect(due).toHaveValue("2026-11-10");
    expect(screen.getByRole("status")).toHaveTextContent("Not saved");
  });

  it("saves text fields on blur, trims the title, and skips unchanged values", async () => {
    setup();
    const title = screen.getByLabelText("Title");
    await userEvent.click(title);
    await userEvent.tab();
    expect(actions.updateTaskFields).not.toHaveBeenCalled();

    await userEvent.clear(title);
    await userEvent.type(title, "  Write the first issue  {Enter}");
    expect(actions.updateTaskFields).toHaveBeenCalledWith("t1", { title: "Write the first issue" });
  });

  it("never saves an empty title; it restores the previous one", async () => {
    setup();
    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.tab();
    expect(actions.updateTaskFields).not.toHaveBeenCalled();
    expect(title).toHaveValue("Write first issue");
  });

  it("saves a change back to the original value made before the page refreshed", async () => {
    setup();
    const priority = screen.getByLabelText("Priority");
    await userEvent.selectOptions(priority, "high");
    await userEvent.selectOptions(priority, "medium");
    // Two saves: "medium" is not skipped just because the stale server props still say medium.
    expect(actions.updateTaskFields).toHaveBeenNthCalledWith(2, "t1", { priority: "medium" });
  });

  it("saves tags on blur through the tag action", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Tags"), "writing, deep work");
    await userEvent.tab();
    expect(actions.setTaskTags).toHaveBeenCalledWith("t1", "writing, deep work");
  });
});
