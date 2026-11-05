import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskFilterChips } from "@/components/tasks/filter-chips";
import { TaskBoard } from "@/components/tasks/task-board";
import { currentTaskView, TaskViews } from "@/components/tasks/task-views";
import { parseTaskFilters } from "@/features/tasks/filters";
import type { TaskView } from "@/features/tasks/queries";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const setTaskStatus = vi.hoisted(() => vi.fn());
vi.mock("@/features/tasks/actions", () => ({ setTaskStatus }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const PROJECT = "11111111-1111-4111-8111-111111111111";

describe("Task views", () => {
  it("maps filters to the matching quick view, and none for custom combinations", () => {
    expect(currentTaskView(parseTaskFilters({}))).toBe("open");
    expect(currentTaskView(parseTaskFilters({ due: "today" }))).toBe("today");
    expect(currentTaskView(parseTaskFilters({ status: "done" }))).toBe("done");
    expect(currentTaskView(parseTaskFilters({ status: "in_progress", due: "today" }))).toBe("");
  });

  it("switches view but keeps other filters", () => {
    render(<TaskViews filters={parseTaskFilters({ project: PROJECT, q: "draft" })} />);
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overdue" })).toHaveAttribute(
      "href",
      `/tasks?q=draft&project=${PROJECT}&due=overdue`,
    );
  });
});

describe("Task filter chips", () => {
  beforeEach(() => push.mockReset());

  it("applies a choice at once by navigating, preserving the other filters", async () => {
    render(
      <TaskFilterChips
        filters={parseTaskFilters({ due: "week" })}
        projects={[{ id: PROJECT, name: "Newsletter" }]}
        areas={[]}
        tags={[]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Priority/ }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "High" }));
    expect(push).toHaveBeenCalledWith("/tasks?priority=high&due=week");
  });

  it("shows the active value on the chip and offers Clear", () => {
    render(
      <TaskFilterChips
        filters={parseTaskFilters({ project: PROJECT })}
        projects={[{ id: PROJECT, name: "Newsletter" }]}
        areas={[]}
        tags={[]}
      />,
    );
    expect(screen.getByRole("button", { name: /Project: Newsletter/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/tasks");
  });

  it("keeps the other filters when searching without JavaScript (GET form)", () => {
    render(
      <TaskFilterChips
        filters={parseTaskFilters({ due: "today", project: PROJECT })}
        projects={[]}
        areas={[]}
        tags={[]}
      />,
    );
    const form = screen.getByRole("search", { name: "Search tasks" });
    const hidden = [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map(
      (i) => `${i.name}=${i.value}`,
    );
    expect(hidden).toEqual(expect.arrayContaining([`project=${PROJECT}`, "due=today"]));
    expect(within(form).getByRole("searchbox", { name: "Search tasks" })).toHaveAttribute(
      "name",
      "q",
    );
  });
});

const task = (id: string, status: TaskView["status"]): TaskView =>
  ({
    id,
    title: `Task ${id}`,
    description: null,
    status,
    priority: "medium",
    due_date: null,
    due_time: null,
    estimate_minutes: null,
    project_id: null,
    area_id: null,
    parent_task_id: null,
    sort_order: 0,
    completed_at: null,
    created_at: "2026-11-01T00:00:00Z",
    recurrence_frequency: null,
    recurrence_interval: 1,
    recurrence_weekdays: null,
    recurrence_until: null,
    recurrence_anchor: null,
    project: null,
    area: null,
    tags: [],
    subtasks: { done: 0, total: 0 },
    openBlockers: 0,
  }) as TaskView;

function drag(card: HTMLElement, column: HTMLElement) {
  const data = new Map<string, string>();
  const dataTransfer = {
    setData: (k: string, v: string) => data.set(k, v),
    getData: (k: string) => data.get(k) ?? "",
    get types() {
      return [...data.keys()];
    },
    effectAllowed: "",
    dropEffect: "",
  };
  fireEvent.dragStart(card, { dataTransfer });
  const over = createEvent.dragOver(column, { dataTransfer });
  fireEvent(column, over);
  fireEvent.drop(column, { dataTransfer });
}

describe("Task board drag and drop", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves a card to the column it is dropped on and saves the new status", async () => {
    setTaskStatus.mockResolvedValue({ ok: true });
    render(<TaskBoard tasks={[task("a", "todo")]} today="2026-11-05" />);
    const card = screen.getByRole("link", { name: "Task a" }).closest("li")!;
    drag(card, screen.getByRole("region", { name: /In progress/ }));
    expect(
      within(screen.getByRole("region", { name: /In progress/ })).getByText("Task a"),
    ).toBeInTheDocument();
    expect(setTaskStatus).toHaveBeenCalledWith("a", "in_progress");
  });

  it("snaps back and explains when the server refuses", async () => {
    setTaskStatus.mockResolvedValue({ ok: false, error: "This task depends on unfinished tasks." });
    render(<TaskBoard tasks={[task("a", "todo")]} today="2026-11-05" />);
    const card = screen.getByRole("link", { name: "Task a" }).closest("li")!;
    drag(card, screen.getByRole("region", { name: /Done/ }));
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This task depends on unfinished tasks."),
    );
    expect(
      within(screen.getByRole("region", { name: /To do/ })).getByText("Task a"),
    ).toBeInTheDocument();
  });

  it("snaps back instead of crashing when the request never reaches the server", async () => {
    setTaskStatus.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<TaskBoard tasks={[task("a", "todo")]} today="2026-11-05" />);
    const card = screen.getByRole("link", { name: "Task a" }).closest("li")!;
    drag(card, screen.getByRole("region", { name: /Done/ }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String(toast.error.mock.calls[0]![0])).toMatch(/wasn't saved/);
    expect(
      within(screen.getByRole("region", { name: /To do/ })).getByText("Task a"),
    ).toBeInTheDocument();
  });

  it("does the same from the keyboard with the status menu", async () => {
    setTaskStatus.mockResolvedValue({ ok: true });
    render(<TaskBoard tasks={[task("a", "todo")]} today="2026-11-05" />);
    await userEvent.selectOptions(screen.getByLabelText("Status of “Task a”"), "done");
    expect(setTaskStatus).toHaveBeenCalledWith("a", "done");
    expect(
      within(screen.getByRole("region", { name: /Done/ })).getByText("Task a"),
    ).toBeInTheDocument();
  });
});
