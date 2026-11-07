import { expect, test, type Page } from "@playwright/test";
import { expectToast, signUpAndConfirm } from "./account";

/*
 * Layout and keyboard checks across the app at phone (390px) and desktop (1440px) widths: no page
 * scrolls sideways, each has exactly one h1 and a skip link, and the global shortcuts work. Long
 * titles are seeded on purpose: unbroken text is what usually pushes a layout wider than the
 * screen.
 */

const ROUTES = [
  "/dashboard",
  "/today",
  "/inbox",
  "/tasks",
  "/tasks?view=board",
  "/planner",
  "/planner?view=day",
  "/planner?view=month",
  "/planner?view=year",
  "/projects",
  "/goals",
  "/goals/vision",
  "/habits",
  "/notes",
  "/journal",
  "/reviews",
  "/focus",
  "/settings",
];

const LONG_TASK = "Prepare the quarterly accessibility and performance report for the whole team";
const LONG_IDEA =
  "Supercalifragilisticexpialidocious-unbroken-idea-title-that-never-wraps-naturally";

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test("every page fits phone and desktop widths, with keyboard shortcuts", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndConfirm(page);

  await test.step("seed content with long titles", async () => {
    await page.goto("/tasks");
    await page.getByPlaceholder("Add a task").fill(`${LONG_TASK} today`);
    await page.keyboard.press("Enter");
    await expectToast(page, "Task added");
    await page.goto("/inbox");
    await page.getByLabel("Idea", { exact: true }).fill(LONG_IDEA);
    await page.getByRole("button", { name: "Capture", exact: true }).click();
    await expectToast(page, "Idea captured");
  });

  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["desktop", 1440, 900],
  ] as const) {
    await test.step(`${name} (${width}px): no sideways scrolling, one h1`, async () => {
      await page.setViewportSize({ width, height });
      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        expect(await horizontalOverflow(page), `${route} at ${width}px`).toBe(0);
        await expect(page.getByRole("heading", { level: 1 }), route).toHaveCount(1);
      }
    });
  }

  await test.step("skip link moves focus to the content", async () => {
    await page.goto("/today");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  await test.step("? opens the shortcut list; j moves through rows; Enter opens one", async () => {
    await page.goto("/inbox");
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Shift+Slash");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(help).toBeVisible();
    await expect(help).toContainText("Next item");
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();

    await page.keyboard.press("j");
    await expect(page.getByRole("link", { name: LONG_IDEA })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/inbox\/[0-9a-f-]{36}/);
  });

  await test.step("shortcuts stay out of the way while typing", async () => {
    await page.goto("/inbox");
    const field = page.getByLabel("Idea", { exact: true });
    await field.fill("");
    await field.pressSequentially("jk?");
    await expect(field).toHaveValue("jk?");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
