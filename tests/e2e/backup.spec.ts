import { expect, test } from "@playwright/test";
import { expectToast, signUpAndConfirm } from "./account";

test("export a backup, then restore it in the browser", async ({ page }) => {
  test.setTimeout(60_000);
  await signUpAndConfirm(page);

  await test.step("capture something to back up", async () => {
    await page.locator("main").click();
    await page.keyboard.press("q");
    const dialog = page.getByRole("dialog", { name: "Quick capture" });
    await dialog.getByPlaceholder("What's on your mind?").fill("Backup survives restore");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expectToast(page, "Saved to Inbox");
  });

  await page.goto("/settings");

  const download = await test.step("download the JSON backup", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download full backup (JSON)" }).click(),
    ]);
    return download;
  });

  await test.step("the browser keeps automatic snapshots", async () => {
    await expect(page.getByText("Browser-local snapshots")).toBeVisible();
  });

  await test.step("upload the backup and preview it", async () => {
    await page.getByLabel("Backup file").setInputFiles(await download.path());
    await expect(page.getByText(/record.*across.*table/)).toBeVisible();
  });

  await test.step("replace-restore from the backup", async () => {
    await page.getByRole("radio", { name: /Replace/ }).check();
    await page.getByRole("button", { name: "Replace from backup" }).click();
    await page.getByRole("button", { name: "Delete & replace" }).click();
    await expectToast(page, "Imported");
  });

  await test.step("the captured idea is still there after restore", async () => {
    await page.goto("/inbox");
    await expect(page.getByRole("link", { name: "Backup survives restore" })).toBeVisible();
  });
});
