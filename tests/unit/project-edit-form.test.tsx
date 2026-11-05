import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectEditForm } from "@/components/projects/project-edit-form";

const updateProject = vi.hoisted(() => vi.fn());
vi.mock("@/features/projects/actions", () => ({ updateProject }));

const project = {
  id: "p1",
  workspace_id: "w1",
  name: "Launch a newsletter",
  description: "Monthly, short, honest",
  notes: null,
  status: "active",
  area_id: null,
  goal_id: null,
  start_date: null,
  due_date: null,
  sort_order: 0,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
} as const;

describe("ProjectEditForm", () => {
  it("keeps the outcome field the e2e journey reads", () => {
    render(<ProjectEditForm project={project} areas={[]} />);
    expect(screen.getByLabelText("Outcome / description")).toHaveValue("Monthly, short, honest");
  });

  it("reports a save that never reaches the server instead of crashing", async () => {
    updateProject.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ProjectEditForm project={project} areas={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(await screen.findByText(/wasn't saved/)).toBeInTheDocument();
  });
});
