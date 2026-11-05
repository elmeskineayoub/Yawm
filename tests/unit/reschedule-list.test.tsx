import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RescheduleList } from "@/components/planner/schedule-lists";

vi.mock("@/features/planning/actions", () => ({ linkToPlan: vi.fn() }));
vi.mock("@/features/tasks/actions", () => ({ moveTaskDeadline: vi.fn() }));
vi.mock("@fullcalendar/interaction", () => ({ Draggable: vi.fn() }));

const item = (n: number) => ({
  task: {
    id: `t${n}`,
    title: `Task ${n}`,
    status: "todo" as const,
    priority: "medium" as const,
    due_date: "2026-11-01",
    estimate_minutes: null,
  },
  reasons: ["overdue" as const],
});

describe("RescheduleList", () => {
  it("is a named region that previews three items and expands on request", async () => {
    render(
      <RescheduleList items={[1, 2, 3, 4, 5].map(item)} today="2026-11-05" onSchedule={() => {}} />,
    );
    const region = screen.getByRole("region", { name: /Needs rescheduling/ });
    expect(region).toHaveTextContent("5");
    expect(screen.getAllByRole("link", { name: /^Task \d$/ })).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Show all 5" }));
    expect(screen.getAllByRole("link", { name: /^Task \d$/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Show fewer" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("offers explicit choices for each item and renders nothing when empty", () => {
    const { rerender } = render(
      <RescheduleList items={[item(1)]} today="2026-11-05" onSchedule={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Schedule…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move deadline…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
    rerender(<RescheduleList items={[]} today="2026-11-05" onSchedule={() => {}} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
