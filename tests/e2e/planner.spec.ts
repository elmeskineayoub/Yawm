import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectToast, signUpAndConfirm } from "./account";

/*
 * The device runs in New York; the user's profile timezone is Tokyo. Every date and time in the
 * Planner must follow the profile, never the device.
 */
test.use({ timezoneId: "America/New_York" });

const PROFILE_TZ = "Asia/Tokyo";

function dateIn(timeZone: string, offsetDays = 0) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Drags with real mouse movement, which FullCalendar's pointer handling needs. */
async function drag(page: Page, from: Locator, to: { x: number; y: number }) {
  const box = (await from.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 12));
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + 15, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.up();
}

async function slotPoint(page: Page, time: string) {
  const lane = page.locator(`.fc-timegrid-slot-lane[data-time="${time}"]`).first();
  await lane.scrollIntoViewIfNeeded();
  const box = (await lane.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const block = (page: Page, title: string) =>
  page.locator(".fc-timegrid-event", { hasText: title }).first();

test("plan from year to day, schedule work, and keep it all in sync", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndConfirm(page);
  const today = dateIn(PROFILE_TZ);
  const tomorrow = dateIn(PROFILE_TZ, 1);
  const yesterday = dateIn(PROFILE_TZ, -1);

  await test.step("set the profile timezone, different from the device's", async () => {
    await page.goto("/settings");
    await page.getByLabel("Timezone").selectOption(PROFILE_TZ);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  });

  await test.step("navigate periods with the switcher and keyboard", async () => {
    await page.goto("/planner");
    await expect(page.getByRole("link", { name: "Week", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("d");
    await expect(page).toHaveURL(new RegExp(`view=day&date=${today}`));
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(new RegExp(`view=day&date=${tomorrow}`));
    await page.keyboard.press("t");
    await expect(page).toHaveURL(new RegExp(`view=day&date=${today}`));
    await page.getByRole("link", { name: "Year", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(today.slice(0, 4));
  });

  await test.step("set the year's direction inline and add an outcome", async () => {
    await page.getByRole("button", { name: "Direction" }).click();
    await page.getByLabel("Direction").fill("Health and craft");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.getByLabel("Add an outcome").fill("Run a half marathon");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Run a half marathon" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Direction" })).toHaveText("Health and craft");
  });

  await test.step("week: add a priority and link an existing task", async () => {
    await page.goto("/tasks");
    await page.getByPlaceholder("Add a task").fill("Read research notes");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expectToast(page, "Task added");

    await page.goto(`/planner?view=week&date=${today}`);
    // The week sits inside the year whose direction was just set.
    await expect(page.getByRole("navigation", { name: "Part of" })).toContainText(
      "Health and craft",
    );
    await page.getByLabel("Add a priority").fill("Draft chapter one");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("list", { name: "Priorities" })).toContainText("Draft chapter one");
    await page.getByRole("button", { name: "Link existing" }).click();
    await page.getByRole("combobox", { name: "Search tasks and projects" }).fill("research");
    await page.getByRole("option", { name: /Read research notes/ }).click();
    await expectToast(page, "Linked");
    await expect(page.getByRole("list", { name: "Priorities" })).toContainText(
      "Read research notes",
    );
  });

  await test.step("drag an unscheduled task onto tomorrow's timeline", async () => {
    await page.goto(`/planner?view=day&date=${tomorrow}`);
    await expect(page.getByText(`Times are shown in ${PROFILE_TZ}`)).toBeVisible();
    const item = page
      .getByRole("list", { name: "Unscheduled tasks" })
      .getByRole("listitem")
      .filter({ hasText: "Read research notes" });
    await drag(page, item, await slotPoint(page, "10:00:00"));
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(block(page, "Read research notes")).toContainText("10:00");
    // Scheduling leaves the task's deadline alone and removes it from the tray.
    await expect(
      page.getByRole("list", { name: "Unscheduled tasks" }).getByText("Read research notes"),
    ).toHaveCount(0);
  });

  await test.step("click an empty slot to create an overlapping block and see a warning", async () => {
    const point = await slotPoint(page, "13:00:00");
    await page.mouse.click(point.x, point.y);
    const panel = page.getByRole("dialog", { name: "New time block" });
    await panel.getByLabel("Title").fill("Standup");
    await panel.getByLabel("Start").fill("10:15");
    await panel.getByLabel("End").fill("10:45");
    await expect(panel.getByText("Overlaps with Read research notes")).toBeVisible();
    await panel.getByRole("button", { name: "Save" }).click();
    await expectToast(page, "Overlaps with Read research notes");
    await expect(page.locator(".planner-block-overlap")).toHaveCount(2);
  });

  await test.step("move and resize blocks by dragging", async () => {
    await drag(page, block(page, "Standup"), await slotPoint(page, "14:00:00"));
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(block(page, "Standup")).toContainText("14:");
    await expect(page.locator(".planner-block-overlap")).toHaveCount(0);

    const research = block(page, "Read research notes");
    await research.hover();
    const resizer = research.locator(".fc-event-resizer-end");
    const target = await slotPoint(page, "11:00:00");
    await drag(page, resizer, { x: target.x, y: target.y + 10 });
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(block(page, "Read research notes")).toContainText("10:00 - 11:30");
  });

  await test.step("the same moment appears on Today in the profile timezone", async () => {
    await page.goto(`/planner?view=day&date=${tomorrow}`);
    await block(page, "Read research notes").click();
    const panel = page.getByRole("dialog", { name: "Edit time block" });
    await expect(panel.getByLabel("Start")).toHaveValue("10:00");
    await expect(panel.getByText(PROFILE_TZ)).toBeVisible();
    await page.keyboard.press("Escape");
  });

  await test.step("reschedule unfinished work explicitly", async () => {
    await page.goto("/tasks");
    await page.getByPlaceholder("Add a task").fill("Renew passport");
    await page.getByLabel("Due date").first().fill(yesterday);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expectToast(page, "Task added");

    await page.goto(`/planner?view=day&date=${today}`);
    const needs = page.getByRole("region", { name: "Needs rescheduling" });
    await expect(needs).toContainText("Renew passport");
    await needs.getByRole("button", { name: "Move deadline…" }).click();
    await page.getByRole("button", { name: "Tomorrow" }).click();
    await expectToast(page, "Deadline moved to Tomorrow");
    await expect(needs).toHaveCount(0);
  });

  await test.step("carry unfinished week priorities forward", async () => {
    await page.goto(`/planner?view=week&date=${today}`);
    await page.getByRole("button", { name: /Carry 2 unfinished/ }).click();
    await page.getByRole("button", { name: "Carry forward" }).click();
    await expectToast(page, "Carried 2");
    await page.getByRole("link", { name: "Next week" }).click();
    await expect(page.getByRole("list", { name: "Priorities" })).toContainText("Draft chapter one");
  });
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("puts priorities first, defaults the week to an agenda, and never scrolls sideways", async ({
    page,
  }) => {
    await signUpAndConfirm(page);
    for (const view of ["day", "week", "month", "year"]) {
      await page.goto(`/planner?view=${view}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${view} view overflows horizontally`).toBeLessThanOrEqual(0);
    }
    await page.goto("/planner?view=week");
    await expect(page.getByRole("button", { name: "Agenda" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const focus = await page.getByRole("complementary", { name: "Plan" }).boundingBox();
    const calendar = await page.getByRole("region", { name: "Calendar" }).boundingBox();
    expect(focus!.y).toBeLessThan(calendar!.y);
  });
});
