import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";

const setTaskStatus = vi.hoisted(() => vi.fn());
vi.mock("@/features/tasks/actions", () => ({ setTaskStatus }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

describe("TaskCheckbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTaskStatus.mockResolvedValue({ ok: true });
  });

  it("completes a one-off task and offers Undo that restores the previous status", async () => {
    render(<TaskCheckbox taskId="t1" title="Write" status="in_progress" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete “Write”" }));
    expect(setTaskStatus).toHaveBeenCalledWith("t1", "done");
    const [message, options] = toast.success.mock.calls[0]!;
    expect(message).toBe("Completed “Write”");
    expect(options.action.label).toBe("Undo");
    await options.action.onClick();
    expect(setTaskStatus).toHaveBeenLastCalledWith("t1", "in_progress");
  });

  it("does not offer Undo for a recurring task (its next occurrence already exists)", async () => {
    render(<TaskCheckbox taskId="t1" title="Water plants" status="todo" recurring />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete “Water plants”" }));
    expect(toast.success).toHaveBeenCalledWith(
      "Completed “Water plants”. The next one is on your list.",
    );
    expect(toast.success.mock.calls[0]).toHaveLength(1);
  });

  it("rolls back and explains when the server refuses", async () => {
    setTaskStatus.mockResolvedValue({ ok: false, error: "This task depends on unfinished tasks." });
    render(<TaskCheckbox taskId="t1" title="Ship" status="todo" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete “Ship”" }));
    expect(toast.error).toHaveBeenCalledWith("This task depends on unfinished tasks.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Complete “Ship”" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
