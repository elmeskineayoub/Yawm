import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectToast, signUpAndConfirm } from "./account";

/*
 * Phase 4 journeys: habits (check-off, rest days, amounts, history edits, Planner Day), goals
 * (milestones, linked work, year outcomes, idea conversion), and the private vision board.
 * The profile timezone is UTC so day labels are easy to compute.
 */

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

function utcDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));

async function useUtc(page: Page) {
  await page.goto("/settings");
  await page.getByLabel("Timezone").selectOption("UTC");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
}

async function addHabit(page: Page, title: string) {
  await page.getByLabel("Add a habit").fill(title);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
}

test("habits: track, rest, correct history, and see them in the Planner", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndConfirm(page);
  await useUtc(page);
  const today = utcDate();
  const yesterday = utcDate(-1);

  await test.step("add habits and check one off", async () => {
    await page.goto("/habits");
    await expect(page.getByText("No habits yet")).toBeVisible();
    await addHabit(page, "Morning walk");
    await addHabit(page, "Read");
    await page.getByRole("checkbox", { name: "Mark “Morning walk” done" }).click();
    await expect(
      page.getByRole("checkbox", { name: "Mark “Morning walk” not done" }),
    ).toBeChecked();
    // The tick is optimistic; the streak is rendered by the server once the save is confirmed.
    const walk = page.getByRole("listitem").filter({ hasText: "Morning walk" });
    await expect(walk).toContainText("1-day streak");
    await page.reload();
    await expect(walk).toContainText("1-day streak");
    await expect(page.getByRole("heading", { name: /Today/ })).toContainText("1/2");
  });

  await test.step("a rest day is excused, not a miss", async () => {
    await page.getByRole("button", { name: "Rest day for “Read”" }).click();
    await expect(page.getByRole("button", { name: "Undo rest day for “Read”" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The 7-day strip is server-rendered: it shows the rest day once the save is confirmed.
    await expect(page.getByRole("list", { name: "Read, last 7 days" })).toContainText("rest day");
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: "Read" })).toContainText("Rest day");
  });

  await test.step("make a habit measurable and log an amount", async () => {
    await page.getByRole("link", { name: "Read" }).click();
    await page.getByRole("radio", { name: "An amount" }).click();
    await page.getByLabel("Daily target").fill("20");
    await page.getByLabel("Unit (optional)").fill("pages");
    await page.getByLabel("Starts").fill(utcDate(-7));
    await page.getByRole("button", { name: "Save habit" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await expect(page.getByText("Every day · target 20 pages")).toBeVisible();

    const amount = page.getByLabel(/Read: amount in pages/);
    await amount.fill("25");
    await amount.press("Enter");
    await expect(amount).toHaveValue("25");
    // 25 of 20 pages completes today: the server-rendered streak confirms the save.
    await expect(page.getByText("1-day streak").first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/Read: amount in pages/)).toHaveValue("25");
  });

  await test.step("correcting a past day recalculates the streak", async () => {
    await page.getByRole("button", { name: `${longDate(yesterday)}: Missed. Change` }).click();
    await page.getByLabel("Amount", { exact: true }).fill("20");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("button", { name: `${longDate(yesterday)}: Done (20 pages). Change` }),
    ).toBeVisible();
    await expect(page.getByText("2-day streak").first()).toBeVisible();
  });

  await test.step("the Planner Day view shows the day's habits", async () => {
    await page.goto(`/planner?view=day&date=${today}`);
    const habits = page.getByRole("list", { name: `Habits for ${today}` });
    await expect(habits).toContainText("Morning walk");
    await expect(
      habits.getByRole("checkbox", { name: "Mark “Morning walk” not done" }),
    ).toBeChecked();
    // A future day is read-only.
    await page.goto(`/planner?view=day&date=${utcDate(1)}`);
    await expect(page.getByRole("checkbox", { name: "Mark “Morning walk” done" })).toBeDisabled();
  });

  await test.step("archive keeps the history out of today's list", async () => {
    await page.goto("/habits");
    await page.getByRole("link", { name: "Morning walk" }).click();
    await page.getByRole("button", { name: "Archive" }).click();
    await expectToast(page, "Habit archived");
    await page.goto("/habits");
    await expect(page.getByRole("link", { name: "Morning walk" })).toHaveCount(0);
    await page.getByRole("link", { name: "Archived habits" }).click();
    await expect(page.getByRole("link", { name: "Morning walk" })).toBeVisible();
  });
});

test("goals: milestones, linked work, year outcomes, and ideas", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndConfirm(page);

  await test.step("create a goal with milestones", async () => {
    await page.goto("/projects");
    await page.getByLabel("New project").fill("Training plan");
    await page.getByRole("button", { name: "Create" }).click();
    await expectToast(page, "Project created");

    await page.goto("/goals");
    await page.getByLabel("Add a goal").fill("Run a half marathon");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("link", { name: /Run a half marathon/ }).click();
    for (const m of ["Run 5k", "Run 10k", "Race day"]) {
      await page.getByLabel("Add a milestone").fill(m);
      await page.keyboard.press("Enter");
      await expect(page.getByLabel(`“${m}” done`)).toBeVisible();
    }
    await page.getByRole("button", { name: "Move “Race day” up" }).click();
    const order = page.getByRole("list", { name: "Milestones" }).getByRole("textbox", {
      name: "Milestone title",
    });
    await expect(order.nth(1)).toHaveValue("Race day");
    await page.getByLabel("“Run 5k” done").check();
    await page.reload();
    await expect(
      page.getByRole("progressbar", { name: "Run a half marathon: milestones" }),
    ).toHaveAttribute("aria-valuetext", "1/3 milestones");
  });

  await test.step("link a project and set why it matters", async () => {
    await page.getByRole("button", { name: "Link existing" }).click();
    await page.getByRole("combobox", { name: "Search projects and tasks" }).fill("Training");
    await page.getByRole("option", { name: /Training plan/ }).click();
    await expectToast(page, "Linked");
    await expect(page.getByRole("list", { name: "Linked work" })).toContainText("Training plan");
    await page.getByRole("button", { name: "Why it matters" }).click();
    await page.getByLabel("Why it matters").fill("Proof I can keep a promise to myself.");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeVisible();
  });

  await test.step("the project shows its goal", async () => {
    await page.getByRole("link", { name: "Training plan" }).click();
    const goal = page.getByRole("combobox", { name: "Goal", exact: true });
    await expect(goal.locator("option:checked")).toHaveText("Run a half marathon");
  });

  await test.step("a goal is one of the year's outcomes", async () => {
    await page.goto("/planner?view=year");
    await page.getByRole("button", { name: "Link existing" }).click();
    await page.getByRole("combobox", { name: "Search goals and projects" }).fill("half");
    await page.getByRole("option", { name: /Run a half marathon/ }).click();
    await expectToast(page, "Linked");
    await expect(page.getByRole("list", { name: "Major outcomes" })).toContainText(
      "1/3 milestones",
    );
    // Typing an outcome creates a new goal.
    await page.getByLabel("Add an outcome").fill("Learn to swim");
    await page.keyboard.press("Enter");
    await page.getByRole("link", { name: "Learn to swim" }).click();
    await expect(page).toHaveURL(/\/goals\/[0-9a-f-]{36}$/);
  });

  await test.step("an idea becomes a goal", async () => {
    await page.goto("/inbox");
    await page.getByLabel("Idea", { exact: true }).fill("Visit Andalusia");
    await page.getByRole("button", { name: "Capture", exact: true }).click();
    await page.getByRole("button", { name: "Convert “Visit Andalusia” to a goal" }).click();
    await expect(page).toHaveURL(/\/goals\//);
    await expect(page.getByRole("button", { name: "Goal", exact: true })).toHaveText(
      "Visit Andalusia",
    );
  });
});

test("vision board: private images, editing, and reordering", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndConfirm(page);
  await page.goto("/goals");
  await page.getByLabel("Add a goal").fill("Live by the sea");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expectToast(page, "Goal added");
  await page.getByRole("link", { name: "Vision board" }).click();
  const board = page.getByRole("list", { name: "Vision board" });

  await test.step("add a text card and an image card", async () => {
    await page.getByLabel("Add a card").fill("Slow mornings");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(board).toContainText("Slow mornings");
    await page.getByLabel("Choose an image for a new card").setInputFiles(fixture("dawn.png"));
    await expectToast(page, "Image card added");
    const image = board.getByRole("img", { name: "dawn" });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(240);
  });

  await test.step("images are private: only a signed URL works", async () => {
    const src = await board.getByRole("img", { name: "dawn" }).getAttribute("src");
    expect(src).toContain("token=");
    const unsigned = src!.replace("/object/sign/", "/object/public/").split("?")[0]!;
    const response = await page.request.get(unsigned);
    expect(response.ok()).toBe(false);
  });

  await test.step("edit a card: text, description, goal, and replace the image", async () => {
    await page.getByRole("button", { name: "Edit “dawn”" }).click();
    const panel = page.getByRole("dialog", { name: "Edit card" });
    await panel.getByLabel("Title").fill("Sunrise swims");
    await panel.getByLabel("Image description").fill("Orange sky over calm water");
    await panel.getByLabel("Goal").selectOption({ label: "Live by the sea" });
    await panel.getByRole("button", { name: "Save" }).click();
    await expectToast(page, "Card saved");
    await expect(board.getByRole("img", { name: "Orange sky over calm water" })).toBeVisible();
    await expect(board).toContainText("Goal: Live by the sea");

    await page.getByRole("button", { name: "Edit “Sunrise swims”" }).click();
    await page.getByLabel("Choose an image for this card").setInputFiles(fixture("sea.png"));
    await expectToast(page, "Image replaced");
  });

  await test.step("reorder with the keyboard-accessible buttons", async () => {
    await expect(board.getByRole("listitem").first()).toContainText("Slow mornings");
    await page.getByRole("button", { name: "Move “Sunrise swims” earlier" }).click();
    await expect(board.getByRole("listitem").first()).toContainText("Sunrise swims");
    await page.reload();
    await expect(board.getByRole("listitem").first()).toContainText("Sunrise swims");
  });

  await test.step("the goal shows its card; remove the image and delete a card", async () => {
    await page.getByRole("link", { name: "Goals", exact: true }).click();
    await page.getByRole("link", { name: /Live by the sea/ }).click();
    await expect(page.getByRole("list", { name: "Vision cards" }).getByRole("img")).toBeVisible();

    await page.getByRole("link", { name: "Open on the board" }).click();
    await page.getByRole("button", { name: "Edit “Sunrise swims”" }).click();
    await page.getByRole("button", { name: "Remove image" }).click();
    await expectToast(page, "Image removed");
    await expect(board.getByRole("img")).toHaveCount(0);

    await page.goto("/goals/vision");
    await page.getByRole("button", { name: "Edit “Slow mornings”" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expectToast(page, "Card deleted");
    await expect(board).not.toContainText("Slow mornings");
  });
});
