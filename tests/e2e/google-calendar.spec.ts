import { expect, test, type Page } from "@playwright/test";
import { expectToast, signUpAndConfirm } from "./account";
import { MOCK_GOOGLE_ORIGIN } from "./mock-google";

/*
 * Google Calendar against the simulated Google service (tests/e2e/mock-google.ts). The profile
 * timezone is UTC so Google event times are easy to write down.
 */

type MockEvent = {
  id: string;
  status: string;
  summary?: string;
  extendedProperties?: { private?: { yawmBlockId?: string } };
};

async function admin(path: string, init?: { method?: string; body?: unknown }) {
  const response = await fetch(`${MOCK_GOOGLE_ORIGIN}/__admin/${path}`, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  expect(response.ok, `mock admin ${path}`).toBe(true);
  return response.json() as Promise<unknown>;
}

async function yawmEvents(email: string) {
  const events = (await admin(`events/${encodeURIComponent(email)}`)) as MockEvent[];
  return events.filter(
    (e) => e.extendedProperties?.private?.yawmBlockId && e.status !== "cancelled",
  );
}

const tomorrow = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

async function slotPoint(page: Page, time: string) {
  const lane = page.locator(`.fc-timegrid-slot-lane[data-time="${time}"]`).first();
  await lane.scrollIntoViewIfNeeded();
  const box = (await lane.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const syncStatus = (page: Page) =>
  page
    .getByRole("region", { name: "Calendar" })
    .getByRole("status")
    .filter({ hasText: /Google/ });

test("connect Google Calendar, see its events, sync blocks once, and recover", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndConfirm(page);
  const day = tomorrow();
  let email = "";

  await test.step("a forged or replayed callback is rejected", async () => {
    await page.goto("/api/integrations/google-calendar/callback?code=stolen&state=forged");
    await expect(page).toHaveURL(/\/settings\?google=state/);
    await expect(page.getByRole("alert").filter({ hasText: "didn't match" })).toBeVisible();
  });

  await test.step("declining consent connects nothing", async () => {
    await admin("deny-next", { method: "POST" });
    await page.getByRole("button", { name: "Connect Google Calendar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "declined" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Google Calendar" })).toBeVisible();
  });

  await test.step("an explicitly reduced scope is refused", async () => {
    // The user unticked "manage events" on Google's consent screen.
    await admin("grant-next", {
      method: "POST",
      body: { scope: "https://www.googleapis.com/auth/calendar.calendarlist.readonly" },
    });
    await page.getByRole("button", { name: "Connect Google Calendar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "wasn't fully granted" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Google Calendar" })).toBeVisible();
  });

  await test.step("connect and choose calendars", async () => {
    await page.getByLabel("Timezone").selectOption("UTC");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

    // Google leaves `scope` out of the token response when it granted exactly what was
    // requested (RFC 6749 §5.1); that must connect.
    await admin("grant-next", { method: "POST", body: { omitScope: true } });
    await page.getByRole("button", { name: "Connect Google Calendar" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Google Calendar connected." }),
    ).toBeVisible();
    const connectedAs = page.getByText(/Connected as/);
    email = ((await connectedAs.textContent()) ?? "").replace("Connected as", "").trim();
    expect(email).toMatch(/@example\.com$/);
    // Only calendars the user owns are offered; a read-only "Holidays" calendar isn't.
    await expect(page.getByLabel("Show events from Work")).toBeVisible();
    await expect(page.getByLabel("Show events from Holidays")).toHaveCount(0);
    await expect(page.getByLabel(`Add blocks to ${email}`)).toBeChecked();
    await page.getByLabel("Show events from Work").check();
    await page.getByRole("button", { name: "Save calendars" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Calendar choice saved." }),
    ).toBeVisible();
  });

  await test.step("Google events appear read-only in the Planner", async () => {
    await admin(`events/${encodeURIComponent(email)}`, {
      method: "POST",
      body: {
        id: "dentist0001",
        summary: "Dentist",
        start: { dateTime: `${day}T15:00:00Z` },
        end: { dateTime: `${day}T16:00:00Z` },
      },
    });
    await page.goto(`/planner?view=day&date=${day}`);
    const dentist = page.locator(".planner-block-external", { hasText: "Dentist" });
    await expect(dentist).toContainText("15:00");
    await dentist.click();
    const panel = page.getByRole("dialog", { name: "Dentist" });
    await expect(panel).toContainText("From Google Calendar. Read-only here");
    await expect(panel.getByRole("textbox")).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  await test.step("a new block is sent to Google exactly once", async () => {
    const point = await slotPoint(page, "10:00:00");
    await page.mouse.click(point.x, point.y);
    const panel = page.getByRole("dialog", { name: "New time block" });
    await panel.getByLabel("Title").fill("Write report");
    await panel.getByLabel("End").fill("11:00");
    await panel.getByRole("button", { name: "Save" }).click();
    await expectToast(page, "Block added");
    await expect(syncStatus(page)).toContainText("Synced with Google");
    expect((await yawmEvents(email)).map((e) => e.summary)).toEqual(["Write report"]);
  });

  await test.step("a block overlapping a Google event gets a warning", async () => {
    await page.locator(".planner-block", { hasText: "Write report" }).first().click();
    const panel = page.getByRole("dialog", { name: "Edit time block" });
    await expect(panel).toContainText("In Google Calendar");
    await panel.getByLabel("Start").fill("15:30");
    await panel.getByLabel("End").fill("16:30");
    await expect(panel.getByText("Overlaps with Dentist")).toBeVisible();
    await panel.getByLabel("Title").fill("Write final report");
    await panel.getByRole("button", { name: "Save" }).click();
    await expectToast(page, "Block updated");
    await expect(syncStatus(page)).toContainText("Synced with Google");
    const events = await yawmEvents(email);
    expect(events.map((e) => e.summary)).toEqual(["Write final report"]);
  });

  await test.step("a Google outage is reported honestly and retried", async () => {
    await admin("fail", {
      method: "POST",
      body: { pathIncludes: "/events/", method: "PUT", status: 503 },
    });
    await page.locator(".planner-block", { hasText: "Write final report" }).first().click();
    const panel = page.getByRole("dialog", { name: "Edit time block" });
    await panel.getByLabel("Title").fill("Report v3");
    await panel.getByRole("button", { name: "Save" }).click();
    // Saved in Yawm, even though Google failed.
    await expectToast(page, "Block updated");
    await expect(syncStatus(page)).toContainText("Google sync failed");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(syncStatus(page)).toContainText("Synced with Google");
    expect((await yawmEvents(email)).map((e) => e.summary)).toEqual(["Report v3"]);
  });

  await test.step("Sync now is idempotent", async () => {
    await page.goto("/settings#google");
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(page.getByRole("status").filter({ hasText: "already in sync" })).toBeVisible();
    expect(await yawmEvents(email)).toHaveLength(1);
  });

  await test.step("revoked access asks to reconnect; manual scheduling keeps working", async () => {
    await admin(`revoke/${encodeURIComponent(email)}`, { method: "POST" });
    await page.goto(`/planner?view=day&date=${day}`);
    await page.locator(".planner-block", { hasText: "Report v3" }).first().click();
    const panel = page.getByRole("dialog", { name: "Edit time block" });
    await panel.getByLabel("Title").fill("Offline edit");
    await panel.getByRole("button", { name: "Save" }).click();
    await expectToast(page, "Block updated");
    await expect(page.getByRole("link", { name: "Reconnect Google Calendar" })).toBeVisible();
    await page.reload();
    await expect(page.locator(".planner-block", { hasText: "Offline edit" })).toBeVisible();

    await page.goto("/settings#google");
    await expect(page.getByText("Reconnect needed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconnect Google Calendar" })).toBeVisible();
  });

  await test.step("disconnect deletes the connection", async () => {
    await page.getByRole("button", { name: "Disconnect" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByRole("button", { name: "Connect Google Calendar" })).toBeVisible();
    await page.goto(`/planner?view=day&date=${day}`);
    await expect(page.locator(".planner-block-external")).toHaveCount(0);
    await expect(page.locator(".planner-block", { hasText: "Offline edit" })).toBeVisible();
  });
});
