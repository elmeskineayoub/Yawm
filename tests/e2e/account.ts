import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { waitForAuthLink } from "./mailbox";

/** Signs up through the UI, confirms via the emailed link, and lands on the dashboard. */
export async function signUpAndConfirm(page: Page) {
  const email = `e2e-${randomUUID()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(`pw-${randomUUID().slice(0, 12)}`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("Check");
  await page.goto(await waitForAuthLink(email, "Confirm your Yawm account"));
  await expect(page).toHaveURL(/\/dashboard$/);
  return email;
}

/** Waits for the toast that confirms a server-side save. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}
