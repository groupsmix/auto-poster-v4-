import { test, expect } from "./fixtures";

// ============================================================
// Webhook Alerts E2E Tests
// ============================================================

test.describe("Webhook Alerts", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/webhooks");
    await page.waitForSelector("h1", { timeout: 15_000 });
  });

  test("loads webhooks page", async ({ authedPage: page }) => {
    await expect(page.locator("h1").filter({ hasText: /Webhook Alerts/ })).toBeVisible();
  });

  test("shows add webhook button", async ({ authedPage: page }) => {
    await expect(page.getByText("+ Add Webhook")).toBeVisible();
  });

  test("opens create form when clicking add", async ({ authedPage: page }) => {
    await page.getByText("+ Add Webhook").click();
    await expect(page.getByText("New Webhook")).toBeVisible();
    await expect(page.getByPlaceholder("My Discord Webhook")).toBeVisible();
  });

  test("shows summary cards", async ({ authedPage: page }) => {
    await expect(page.getByText("Total Webhooks")).toBeVisible();
    await expect(page.getByText("Total Sent")).toBeVisible();
  });
});
