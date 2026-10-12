import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { waitForAuthLink } from "./mailbox";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("sign up, verify email, use the workspace, sign out, and reset the password", async ({
  page,
}) => {
  const email = `e2e-${randomUUID()}@example.test`;
  const password = `first-${randomUUID().slice(0, 8)}`;
  const newPassword = `second-${randomUUID().slice(0, 8)}`;

  // Protected pages send signed-out visitors to sign-in, remembering where they were going.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);

  // Sign up.
  await page.goto("/sign-up");
  await page.getByLabel("Name (optional)").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("Check");

  // Unverified accounts cannot sign in.
  await signIn(page, email, password);
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Confirm your email address first",
  );

  // Verify via the emailed link; it signs the user in.
  await page.goto(await waitForAuthLink(email, "Confirm your Yawm account"));
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  // The profile captured the browser timezone and name; the default areas were created.
  await page.goto("/settings");
  await expect(page.getByText("E2E Tester")).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  for (const area of ["Spiritual", "Mental", "Physical", "Finances"]) {
    await expect(page.getByRole("textbox", { name: `Name of ${area}` })).toHaveValue(area);
  }

  // Signed-in users skip the auth pages.
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Sign out ends the session.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);

  // Wrong password is rejected without revealing which field was wrong.
  await signIn(page, email, "wrong-password");
  await expect(page.locator("form").getByRole("alert")).toHaveText("Incorrect email or password.");

  // Password reset.
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("password reset link");

  await page.goto(await waitForAuthLink(email, "Reset your Yawm password"));
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, email, password);
  await expect(page.locator("form").getByRole("alert")).toHaveText("Incorrect email or password.");
  await signIn(page, email, newPassword);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a tampered verification link shows a safe error page", async ({ page }) => {
  await page.goto("/auth/callback?token_hash=not-a-real-token&type=email&next=//evil.example");
  await expect(page).toHaveURL(/\/auth\/error\?reason=invalid_link$/);
  await expect(page.getByRole("heading", { name: "This link didn't work" })).toBeVisible();
});
