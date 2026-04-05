import { test, expect } from "./fixtures";

// ============================================================
// Health Dashboard E2E Tests
// ============================================================

test.describe("Health Dashboard", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/health");
    await page.waitForSelector("h1", { timeout: 15_000 });
  });

  test("loads health dashboard page", async ({ authedPage: page }) => {
    await expect(page.locator("h1").filter({ hasText: /Health Dashboard/ })).toBeVisible();
  });

  test("shows success rate cards", async ({ authedPage: page }) => {
    await expect(page.getByText("Workflow Success")).toBeVisible();
    await expect(page.getByText("Publish Success")).toBeVisible();
    await expect(page.getByText("Avg Quality Score")).toBeVisible();
  });

  test("shows API credit usage section", async ({ authedPage: page }) => {
    await expect(page.getByText("API Credit Usage")).toBeVisible();
  });
});
