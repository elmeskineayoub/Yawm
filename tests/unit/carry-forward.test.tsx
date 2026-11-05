import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CarryForward } from "@/components/reviews/carry-forward";

const tasks = vi.hoisted(() => ({
  moveTaskDeadline: vi.fn(),
  moveTaskDeadlines: vi.fn(),
  setTaskStatus: vi.fn(),
}));
vi.mock("@/features/tasks/actions", () => tasks);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const open = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Send invoice",
    due_date: "2026-11-03",
    status: "todo" as const,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Call plumber",
    due_date: "2026-11-05",
    status: "in_progress" as const,
  },
];

describe("Carry forward (weekly review, Decide)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tasks.moveTaskDeadline.mockResolvedValue({ ok: true, data: undefined });
    tasks.moveTaskDeadlines.mockResolvedValue({ ok: true, data: { moved: 2, failed: 0 } });
  });

  it("moves one task to the next week's start, with Undo restoring its date", async () => {
    render(<CarryForward tasks={open} total={2} target="2026-11-09" />);
    await userEvent.click(screen.getByRole("button", { name: /Move “Send invoice” to/ }));
    expect(tasks.moveTaskDeadline).toHaveBeenCalledWith(open[0]!.id, "2026-11-09");
    const [, options] = toast.success.mock.calls[0]!;
    await options.action.onClick();
    expect(tasks.moveTaskDeadlines).toHaveBeenCalledWith([{ id: open[0]!.id, due: "2026-11-03" }]);
  });

  it("moves everything at once, and Undo restores every original date", async () => {
    render(<CarryForward tasks={open} total={2} target="2026-11-09" />);
    await userEvent.click(screen.getByRole("button", { name: /^Move all to/ }));
    expect(tasks.moveTaskDeadlines).toHaveBeenCalledWith([
      { id: open[0]!.id, due: "2026-11-09" },
      { id: open[1]!.id, due: "2026-11-09" },
    ]);
    const [message, options] = toast.success.mock.calls[0]!;
    expect(message).toMatch(/Moved 2 tasks/);
    await options.action.onClick();
    expect(tasks.moveTaskDeadlines).toHaveBeenLastCalledWith([
      { id: open[0]!.id, due: "2026-11-03" },
      { id: open[1]!.id, due: "2026-11-05" },
    ]);
  });

  it("can keep a task without a deadline", async () => {
    render(<CarryForward tasks={open} total={2} target="2026-11-09" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Remove the due date from “Call plumber”" }),
    );
    expect(tasks.moveTaskDeadline).toHaveBeenCalledWith(open[1]!.id, null);
  });

  it("reports a lost connection instead of crashing", async () => {
    tasks.moveTaskDeadline.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<CarryForward tasks={open} total={2} target="2026-11-09" />);
    await userEvent.click(screen.getByRole("button", { name: /Move “Send invoice” to/ }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/wasn't saved|offline/));
  });

  it("says so when nothing is left open", () => {
    render(<CarryForward tasks={[]} total={0} target="2026-11-09" />);
    expect(screen.getByText(/Nothing left open/)).toBeTruthy();
  });
});
