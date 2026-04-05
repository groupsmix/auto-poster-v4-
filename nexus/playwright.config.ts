import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration for NEXUS Dashboard.
 *
 * By default tests run against the deployed Cloudflare Pages site.
 * Override with `NEXUS_BASE_URL` env var for local dev testing.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 60_000,

  use: {
    baseURL:
      process.env.NEXUS_BASE_URL || "https://nexus-dashboard-elk.pages.dev",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
