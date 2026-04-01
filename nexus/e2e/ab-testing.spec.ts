import { test, expect } from "./fixtures";

// ============================================================
// A/B Testing E2E Tests
// ============================================================

test.describe("A/B Testing", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/ab-testing");
    await page.waitForSelector("h1", { timeout: 15_000 });
  });

  test("loads A/B testing page", async ({ authedPage: page }) => {
    await expect(page.locator("h1").filter({ hasText: /A\/B Testing/ })).toBeVisible();
  });

  test("shows summary cards", async ({ authedPage: page }) => {
    await expect(page.getByText("Active Tests")).toBeVisible();
    await expect(page.getByText("Completed Tests")).toBeVisible();
    await expect(page.getByText("Total Tests")).toBeVisible();
  });

  test("shows empty state when no tests exist", async ({ authedPage: page }) => {
    await expect(page.getByText(/No A\/B tests yet|A\/B tests are created automatically/)).toBeVisible();
  });
});
