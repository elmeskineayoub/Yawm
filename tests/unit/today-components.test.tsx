import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RescheduleOverdue } from "@/components/today/reschedule-overdue";
import { TodayLayout } from "@/components/today/today-layout";

const moveTaskDeadlines = vi.hoisted(() => vi.fn());
vi.mock("@/features/tasks/actions", () => ({ moveTaskDeadlines }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

describe("RescheduleOverdue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moveTaskDeadlines.mockResolvedValue({ ok: true, data: { moved: 2, failed: 0 } });
  });

  it("moves every overdue deadline to today only when asked, and Undo restores each date", async () => {
    render(
      <RescheduleOverdue
        today="2026-11-05"
        tasks={[
          { id: "a", due_date: "2026-11-03" },
          { id: "b", due_date: "2026-10-30" },
        ]}
      />,
    );
    expect(moveTaskDeadlines).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Move all to today" }));
    expect(moveTaskDeadlines).toHaveBeenCalledWith([
      { id: "a", due: "2026-11-05" },
      { id: "b", due: "2026-11-05" },
    ]);
    const [message, options] = toast.success.mock.calls[0]!;
    expect(message).toBe("Moved 2 deadlines to today");
    await options.action.onClick();
    expect(moveTaskDeadlines).toHaveBeenLastCalledWith([
      { id: "a", due: "2026-11-03" },
      { id: "b", due: "2026-10-30" },
    ]);
  });

  it("renders nothing when nothing is overdue", () => {
    const { container } = render(<RescheduleOverdue today="2026-11-05" tasks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("TodayLayout", () => {
  it("switches between tasks and schedule on small screens", async () => {
    render(<TodayLayout tasks={<p>task list</p>} schedule={<p>timeline</p>} />);
    const tasks = screen.getByText("task list").parentElement!;
    const schedule = screen.getByRole("complementary", { name: "Schedule and focus" });
    expect(screen.getByRole("button", { name: "Tasks" })).toHaveAttribute("aria-pressed", "true");
    expect(schedule).toHaveClass("max-lg:hidden");
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(schedule).not.toHaveClass("max-lg:hidden");
    expect(tasks).toHaveClass("max-lg:hidden");
  });
});
