import { test, expect } from "./fixtures";

// ============================================================
// Settings Page E2E Tests
// ============================================================

test.describe("Settings", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/settings");
    await page.waitForSelector("h1", { timeout: 15_000 });
  });

  test("loads settings page", async ({ authedPage: page }) => {
    await expect(page.locator("h1").filter({ hasText: /Settings/ })).toBeVisible();
  });
});
