import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { buildDashboardModel } from "@/features/dashboard/model";
import type { DashboardSection } from "@/features/dashboard/sections";
import { dashboardFixture, FIXTURE_TIMEZONE, FIXTURE_TODAY } from "../fixtures/dashboard";

vi.mock("@/features/tasks/actions", () => ({ setTaskStatus: vi.fn(), moveTaskDeadline: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const input = dashboardFixture();
const model = buildDashboardModel(input);

function renderView(hidden: DashboardSection[] = []) {
  return render(
    <DashboardView
      model={model}
      today={FIXTURE_TODAY}
      timezone={FIXTURE_TIMEZONE}
      dateLabel="Wednesday, November 11, 2026"
      hidden={new Set(hidden)}
    />,
  );
}

describe("DashboardView", () => {
  it("leads with one next action that starts a focus session on that task", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    const nextUp = screen.getByRole("region", { name: "Next up" });
    const focus = within(nextUp).getByRole("link", { name: "Start focus" });
    const primary = model.nextUp.primary!.task;
    expect(focus).toHaveAttribute(
      "href",
      `/focus?task=${primary.id}&project=${primary.project!.id}`,
    );
    expect(within(nextUp).getByRole("link", { name: "Open task" })).toHaveAttribute(
      "href",
      `/tasks/${primary.id}`,
    );
    expect(within(nextUp).getAllByRole("link", { name: /^Start focus on/ })).toHaveLength(2);
  });

  it("shows the same counts in the summary, the day, and the attention lists", () => {
    renderView();
    expect(screen.getByText(model.summary)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Overdue" }).children).toHaveLength(2);
    expect(screen.getByRole("list", { name: "Due today" }).children).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 3, name: "Overdue 2" })).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument(); // ideas waiting
  });

  it("lists projects with progress and a focus shortcut each", () => {
    renderView();
    const projects = screen.getByRole("list", { name: "Active projects" });
    expect(within(projects).getAllByRole("listitem")).toHaveLength(5);
    expect(
      screen.getByRole("progressbar", { name: "Pricing page relaunch progress" }),
    ).toHaveAttribute("aria-valuetext", "8 of 13 tasks done");
    expect(
      screen.getByRole("link", { name: "Start focus on Pricing page relaunch" }),
    ).toHaveAttribute("href", `/focus?project=${input.projects[0]!.id}`);
  });

  it("gives the weekly focus chart a readable table", () => {
    renderView();
    const table = screen.getByRole("table", { name: "Focus time per day this week" });
    expect(within(table).getAllByRole("row")).toHaveLength(8);
    expect(within(table).getByText("1h 15m")).toBeInTheDocument();
  });

  it("drops hidden sections and says so when everything is hidden", () => {
    renderView(["attention"]);
    expect(screen.queryByRole("region", { name: "Next up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Overdue" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Active projects" })).toBeInTheDocument();
  });

  it("explains an empty dashboard when every section is hidden", () => {
    renderView(["attention", "today", "week", "progress", "reflect"]);
    expect(screen.getByText(/All sections are hidden/)).toBeInTheDocument();
  });
});
