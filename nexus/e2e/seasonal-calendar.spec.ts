import { test, expect } from "./fixtures";

// ============================================================
// Seasonal Calendar E2E Tests
// ============================================================

test.describe("Seasonal Calendar", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/seasonal-calendar");
    await page.waitForSelector("h1", { timeout: 15_000 });
  });

  test("loads seasonal calendar page", async ({ authedPage: page }) => {
    await expect(page.locator("h1").filter({ hasText: /Seasonal Calendar/ })).toBeVisible();
  });

  test("shows filter buttons", async ({ authedPage: page }) => {
    await expect(page.getByText("All Events")).toBeVisible();
    await expect(page.getByText("Prep Now")).toBeVisible();
    await expect(page.getByText("High Priority")).toBeVisible();
  });

  test("shows seed button or event list", async ({ authedPage: page }) => {
    const seedButton = page.getByText("Seed Default Events");
    const eventCard = page.locator(".rounded-xl").first();
    // Either seed button (empty state) or events should be visible
    const hasSeed = await seedButton.isVisible().catch(() => false);
    const hasEvents = await eventCard.isVisible().catch(() => false);
    expect(hasSeed || hasEvents).toBe(true);
  });
});
