import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomizeDashboard } from "@/components/dashboard/customize-dashboard";
import { summarizeOverview } from "@/features/dashboard/logic";
import { parseDashboardPrefs, serializeHidden } from "@/features/dashboard/sections";

const saveDashboardPrefs = vi.hoisted(() => vi.fn());
vi.mock("@/features/dashboard/actions", () => ({ saveDashboardPrefs }));

describe("dashboard prefs", () => {
  it("parses stored preferences defensively", () => {
    expect([...parseDashboardPrefs({ hidden: ["week", "reflect"] })]).toEqual(["week", "reflect"]);
    expect([...parseDashboardPrefs({ hidden: ["week", "nonsense", 3] })]).toEqual(["week"]);
    expect(parseDashboardPrefs({}).size).toBe(0);
    expect(parseDashboardPrefs(null).size).toBe(0);
    expect(parseDashboardPrefs({ hidden: "week" }).size).toBe(0);
  });

  it("serializes known keys once, in section order", () => {
    expect(serializeHidden(["reflect", "attention", "reflect"])).toEqual({
      hidden: ["attention", "reflect"],
    });
  });
});

describe("summarizeOverview", () => {
  it("describes the whole workspace in one sentence", () => {
    expect(
      summarizeOverview({
        overdue: 4,
        completedThisWeek: 6,
        activeProjects: 3,
        activeGoals: 1,
        inbox: 0,
      }),
    ).toBe("4 overdue, 6 done this week, 3 active projects, 1 active goal, inbox clear.");
    expect(
      summarizeOverview({
        overdue: 0,
        completedThisWeek: 0,
        activeProjects: 0,
        activeGoals: 2,
        inbox: 1,
      }),
    ).toBe("Nothing overdue, 0 done this week, 0 active projects, 2 active goals, 1 idea to sort.");
  });
});

describe("CustomizeDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveDashboardPrefs.mockResolvedValue({ ok: true });
  });

  it("hides a section and reports Saved after the server confirms", async () => {
    render(<CustomizeDashboard hidden={[]} available />);
    await userEvent.click(screen.getByRole("button", { name: "Customize" }));
    const week = screen.getByRole("checkbox", { name: /This week/ });
    expect(week).toBeChecked();
    await userEvent.click(week);
    expect(saveDashboardPrefs).toHaveBeenCalledWith({ hidden: ["week"] });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(week).not.toBeChecked();
  });

  it("puts the checkbox back and explains when saving fails", async () => {
    saveDashboardPrefs.mockResolvedValue({
      ok: false,
      error: "Couldn't save your dashboard layout.",
    });
    render(<CustomizeDashboard hidden={[]} available />);
    await userEvent.click(screen.getByRole("button", { name: "Customize" }));
    const reflect = screen.getByRole("checkbox", { name: /Reflect/ });
    await userEvent.click(reflect);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save");
    expect(reflect).toBeChecked();
  });

  it("explains instead of offering checkboxes before the migration is applied", async () => {
    render(<CustomizeDashboard hidden={[]} available={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Customize" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(/isn't available yet/)).toBeInTheDocument();
  });
});
