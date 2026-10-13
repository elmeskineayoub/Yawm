import { expect, test } from "@playwright/test";
import { expectToast, signUpAndConfirm } from "./account";

test("capture an idea, plan it, and get it done", async ({ page }) => {
  test.setTimeout(90_000);
  await signUpAndConfirm(page);

  await test.step("quick capture an idea from anywhere with the q shortcut", async () => {
    await page.locator("main").click();
    await page.keyboard.press("q");
    const dialog = page.getByRole("dialog", { name: "Quick capture" });
    await dialog.getByPlaceholder("What's on your mind?").fill("Launch a newsletter");
    await dialog.getByPlaceholder("Details (optional)").fill("Monthly, short, honest");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expectToast(page, "Saved to Inbox");
    await expect(dialog).toBeHidden();
  });

  await test.step("convert the idea into a project, keeping the original", async () => {
    await page.goto("/inbox");
    await expect(page.getByRole("link", { name: "Launch a newsletter" })).toBeVisible();
    await page.getByRole("button", { name: "Convert “Launch a newsletter” to a project" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Launch a newsletter");
    await expect(page.getByLabel("Outcome / description")).toHaveValue("Monthly, short, honest");

    await page.goto("/inbox?status=archived");
    await expect(page.getByRole("link", { name: "Launch a newsletter" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open project" })).toBeVisible();
  });

  await test.step("add tasks to the project and see progress", async () => {
    await page.getByRole("link", { name: "Open project" }).click();
    for (const title of ["Pick a platform", "Write first issue"]) {
      await page.getByPlaceholder("Add a task to this project").fill(title);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByRole("link", { name: title })).toBeVisible();
    }
    await expect(page.getByRole("progressbar", { name: "Project progress" })).toHaveAttribute(
      "aria-valuetext",
      "0 of 2 tasks done",
    );
  });

  await test.step("edit a task: due today, priority, tags, weekly recurrence", async () => {
    await page.getByRole("link", { name: "Write first issue" }).click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+$/);
    const today = await page.evaluate(() => new Intl.DateTimeFormat("en-CA").format(new Date()));
    await page.getByLabel("Due date").fill(today);
    await page.getByLabel("Priority").selectOption("high");
    await page.getByLabel("Tags").fill("writing, deep work");
    await page.getByLabel("Frequency").selectOption("weekly");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Tags")).toHaveValue("deep work, writing");
    await expect(page.getByText(/Every week/)).toBeVisible();
  });

  await test.step("dependencies block completion until the blocker is done", async () => {
    await page.getByLabel("Task this one waits on").selectOption({ label: "Pick a platform" });
    await page.getByRole("button", { name: "Add dependency" }).click();
    await expect(page.getByRole("link", { name: "Pick a platform" })).toBeVisible();

    await page.goto("/today");
    await expect(page.getByRole("link", { name: "Write first issue" })).toBeVisible();
    await page.getByRole("checkbox", { name: "Complete “Write first issue”" }).click();
    await expectToast(page, "depends on unfinished tasks");
    await expect(
      page.getByRole("checkbox", { name: "Complete “Write first issue”" }),
    ).toBeVisible();
  });

  await test.step("plan the week around the project", async () => {
    // Old links using ?period= still work.
    await page.goto("/planner?period=week");
    await page.getByRole("button", { name: "Focus" }).click();
    await page.getByRole("textbox", { name: "Focus" }).fill("Ship the first issue");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.getByRole("button", { name: "Link existing" }).click();
    await page.getByRole("combobox", { name: "Search tasks and projects" }).fill("newsletter");
    await page.getByRole("option", { name: /Launch a newsletter/ }).click();
    await expect(
      page
        .getByRole("list", { name: "Priorities" })
        .getByRole("link", { name: "Launch a newsletter" }),
    ).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("Ship the first issue")).toBeVisible();
  });

  await test.step("finish the blocker, then the task; the next occurrence appears", async () => {
    await page.goto("/tasks");
    await page.getByRole("checkbox", { name: "Complete “Pick a platform”" }).click();
    await expect(page.getByRole("link", { name: "Pick a platform" })).toBeHidden();
    await page.getByRole("checkbox", { name: "Complete “Write first issue”" }).click();

    // Completing a weekly task creates next week's occurrence. The completion is an async server
    // action, so re-navigate until the new occurrence has landed rather than asserting once.
    await expect
      .poll(
        async () => {
          await page.goto("/tasks?status=all&q=Write+first+issue");
          return page.getByRole("link", { name: "Write first issue" }).count();
        },
        { timeout: 10_000 },
      )
      .toBe(2);
    await page.goto("/projects");
    await expect(
      page.getByRole("progressbar", { name: "Launch a newsletter progress" }),
    ).toHaveAttribute("aria-valuetext", "2 of 3 tasks done");
  });

  await test.step("customise life areas", async () => {
    await page.goto("/settings");
    await page.getByPlaceholder("Add a custom area").fill("Learning");
    await page.getByRole("button", { name: "Add area" }).click();
    await expectToast(page, "Area added");
    await expect(page.getByRole("textbox", { name: "Name of Learning" })).toHaveValue("Learning");
  });
});
