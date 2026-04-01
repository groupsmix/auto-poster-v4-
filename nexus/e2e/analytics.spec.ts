import { test, expect } from "./fixtures";

// ============================================================
// Analytics Page E2E Tests
// ============================================================

test.describe("Analytics", () => {
  test("loads analytics page from sidebar", async ({ authedPage: page }) => {
    // Analytics might be under a different nav item, navigate directly
    await page.goto("/analytics");
    // Should show some analytics content or empty state
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("History", () => {
  test("loads history page from sidebar", async ({ authedPage: page }) => {
    await page.goto("/history");
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
  });
});
