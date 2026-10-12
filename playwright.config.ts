import { defineConfig, devices } from "@playwright/test";
import { MOCK_GOOGLE_ORIGIN } from "./tests/e2e/mock-google";
import { fakeGoogleConfig } from "./tests/support/fake-google";

// The e2e suite needs a production build configured for the local Supabase stack.
// Port 3000 must match `site_url` in supabase/config.toml, which email links point to.
export default defineConfig({
  testDir: "tests/e2e",
  // A simulated Google service; the app server below is pointed at it.
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Lets environments with a preinstalled Chromium skip `playwright install`.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: "npm run start -- --port 3000",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Google Calendar on, against the local mock only. These are fake, test-only values; the
    // origin override is accepted only for loopback addresses.
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
      ),
      ...fakeGoogleConfig(MOCK_GOOGLE_ORIGIN),
    },
  },
});
