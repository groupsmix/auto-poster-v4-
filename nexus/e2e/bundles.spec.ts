import { test, expect } from "./fixtures";

// ============================================================
// Bundle Creator E2E Tests
// ============================================================

test.describe("Bundle Creator", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/bundles");
    await page.waitForSelector("h1", { timeout: 15_000 });
  });

  test("loads bundles page", async ({ authedPage: page }) => {
    await expect(page.locator("h1").filter({ hasText: /Bundle Creator/ })).toBeVisible();
  });

  test("shows action buttons", async ({ authedPage: page }) => {
    await expect(page.getByText("Auto-Group")).toBeVisible();
    await expect(page.getByText("+ New Bundle")).toBeVisible();
  });

  test("shows summary cards", async ({ authedPage: page }) => {
    await expect(page.getByText("Active Bundles")).toBeVisible();
    await expect(page.getByText("Draft Bundles")).toBeVisible();
    await expect(page.getByText("Total Bundles")).toBeVisible();
  });

  test("opens create form when clicking new bundle", async ({ authedPage: page }) => {
    await page.getByText("+ New Bundle").click();
    await expect(page.getByText("New Bundle")).toBeVisible();
    await expect(page.getByPlaceholder("Complete Student Planner Pack")).toBeVisible();
  });
});
