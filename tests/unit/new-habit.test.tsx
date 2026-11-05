import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewHabit } from "@/components/habits/new-habit";

const createHabit = vi.hoisted(() => vi.fn());
vi.mock("@/features/habits/actions", () => ({ createHabit, updateHabit: vi.fn() }));
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
  render(<NewHabit areas={areas} today="2026-11-05" />);
  await userEvent.click(screen.getByRole("button", { name: "New habit" }));
  return screen.getByRole("dialog", { name: "New habit" });
};

describe("New habit sheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createHabit.mockResolvedValue({ ok: true, data: { id: "h1" } });
  });

  it("creates a habit with its schedule, target, and area in one step", async () => {
    const sheet = await open();
    await userEvent.type(within(sheet).getByLabelText("Name"), "Read");
    await userEvent.click(within(sheet).getByRole("radio", { name: "An amount" }));
    await userEvent.type(within(sheet).getByLabelText("Daily target"), "20");
    await userEvent.type(within(sheet).getByLabelText("Unit (optional)"), "pages");
    await userEvent.click(within(sheet).getByRole("button", { name: "Sun" }));
    await userEvent.selectOptions(within(sheet).getByLabelText("Life area"), AREA);
    // Archived areas are not offered for a new habit.
    expect(within(sheet).queryByRole("option", { name: "Old" })).toBeNull();
    await userEvent.click(within(sheet).getByRole("button", { name: "Create habit" }));

    expect(createHabit).toHaveBeenCalledTimes(1);
    expect(createHabit.mock.calls[0]![0]).toMatchObject({
      title: "Read",
      kind: "measurable",
      target_value: "20",
      unit: "pages",
      frequency: "daily",
      weekdays: [1, 2, 3, 4, 5, 6],
      area_id: AREA,
      starts_on: "2026-11-05",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("“Read” added");
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the sheet open with field errors when the server rejects it", async () => {
    createHabit.mockResolvedValue({
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["That name is too long."] },
    });
    const sheet = await open();
    await userEvent.type(within(sheet).getByLabelText("Name"), "Run");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create habit" }));
    expect(await within(sheet).findByText("That name is too long.")).toBeTruthy();
    expect(within(sheet).getByRole("status").textContent).toBe("Check the highlighted fields.");
    expect(screen.getByRole("dialog", { name: "New habit" })).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reports a lost connection instead of crashing, and keeps what was typed", async () => {
    createHabit.mockRejectedValue(new TypeError("Failed to fetch"));
    const sheet = await open();
    await userEvent.type(within(sheet).getByLabelText("Name"), "Stretch");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create habit" }));
    expect((await within(sheet).findByRole("status")).textContent).toMatch(/wasn't saved|offline/);
    expect((within(sheet).getByLabelText("Name") as HTMLInputElement).value).toBe("Stretch");
  });
});
