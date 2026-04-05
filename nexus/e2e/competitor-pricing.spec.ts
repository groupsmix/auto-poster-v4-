import { test, expect } from "./fixtures";

// ============================================================
// Competitor Price Monitoring E2E Tests
// ============================================================

test.describe("Competitor Price Monitoring", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/competitor-pricing");
    await page.waitForSelector("h1", { timeout: 15_000 });
  });

  test("loads competitor pricing page", async ({ authedPage: page }) => {
    await expect(page.locator("h1").filter({ hasText: /Competitor Price Monitoring/ })).toBeVisible();
  });

  test("shows price rules section", async ({ authedPage: page }) => {
    await expect(page.getByText("Price Rules")).toBeVisible();
    await expect(page.getByText("+ Add Rule")).toBeVisible();
  });

  test("opens rule form when clicking add", async ({ authedPage: page }) => {
    await page.getByText("+ Add Rule").click();
    await expect(page.getByText("Strategy")).toBeVisible();
    await expect(page.getByText("Adjustment %")).toBeVisible();
  });
});
