import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewGoal } from "@/components/goals/new-goal";

const createGoal = vi.hoisted(() => vi.fn());
vi.mock("@/features/goals/actions", () => ({ createGoal }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const AREA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const areas = [
  { id: AREA, name: "Health", archived_at: null },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Old", archived_at: "2026-01-01T00:00:00Z" },
];

const open = async () => {
  render(<NewGoal areas={areas} />);
  await userEvent.click(screen.getByRole("button", { name: "New goal" }));
  return screen.getByRole("dialog", { name: "New goal" });
};

describe("New goal sheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createGoal.mockResolvedValue({ ok: true, data: { id: "g1" } });
  });

  it("creates a goal with why, area, and target date", async () => {
    const sheet = await open();
    await userEvent.type(within(sheet).getByLabelText("Name"), "Run a half marathon");
    await userEvent.type(within(sheet).getByLabelText("Why it matters (optional)"), "Stamina");
    await userEvent.selectOptions(within(sheet).getByLabelText("Life area"), AREA);
    expect(within(sheet).queryByRole("option", { name: "Old" })).toBeNull();
    await userEvent.type(within(sheet).getByLabelText("Target date (optional)"), "2027-04-01");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create goal" }));
    expect(createGoal).toHaveBeenCalledWith({
      title: "Run a half marathon",
      why: "Stamina",
      area_id: AREA,
      target_date: "2027-04-01",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("“Run a half marathon” added", expect.anything());
    expect(refresh).toHaveBeenCalled();
  });

  it("stays open with the error when saving fails", async () => {
    createGoal.mockRejectedValue(new TypeError("Failed to fetch"));
    const sheet = await open();
    await userEvent.type(within(sheet).getByLabelText("Name"), "Learn Spanish");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create goal" }));
    expect((await within(sheet).findByRole("status")).textContent).toMatch(/wasn't saved|offline/);
    expect((within(sheet).getByLabelText("Name") as HTMLInputElement).value).toBe("Learn Spanish");
  });
});
