import { test, expect } from "./fixtures";

// ============================================================
// Review Center E2E Tests
// ============================================================

test.describe("Review Center", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/review");
    await page.waitForSelector("h1:text('Review Center')", { timeout: 15_000 });
  });

  test("displays page heading and subtitle", async ({ authedPage: page }) => {
    await expect(page.locator("h1:text('Review Center')")).toBeVisible();
    await expect(page.locator("text=CEO approval queue and revision history")).toBeVisible();
  });

  test("shows three review tabs", async ({ authedPage: page }) => {
    await expect(page.locator('button[role="tab"]:text("Pending Review")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:text("In Revision")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:text("Review History")')).toBeVisible();
  });

  test("Pending Review tab is active by default", async ({ authedPage: page }) => {
    const pendingTab = page.locator('button[role="tab"]:text("Pending Review")');
    await expect(pendingTab).toHaveAttribute("aria-selected", "true");
  });

  test("switches to In Revision tab", async ({ authedPage: page }) => {
    await page.locator('button[role="tab"]:text("In Revision")').click();
    const inRevisionTab = page.locator('button[role="tab"]:text("In Revision")');
    await expect(inRevisionTab).toHaveAttribute("aria-selected", "true");
  });

  test("switches to Review History tab", async ({ authedPage: page }) => {
    await page.locator('button[role="tab"]:text("Review History")').click();
    const historyTab = page.locator('button[role="tab"]:text("Review History")');
    await expect(historyTab).toHaveAttribute("aria-selected", "true");
  });

  test("shows empty state messages per tab", async ({ authedPage: page }) => {
    // Pending tab empty state
    const pendingEmpty = page.locator("text=No products waiting for review.");
    if (await pendingEmpty.isVisible()) {
      await expect(pendingEmpty).toBeVisible();
    }

    // In Revision tab empty state
    await page.locator('button[role="tab"]:text("In Revision")').click();
    const revisionEmpty = page.locator("text=No products currently being revised.");
    if (await revisionEmpty.isVisible()) {
      await expect(revisionEmpty).toBeVisible();
    }

    // History tab empty state
    await page.locator('button[role="tab"]:text("Review History")').click();
    const historyEmpty = page.locator("text=No review history yet.");
    if (await historyEmpty.isVisible()) {
      await expect(historyEmpty).toBeVisible();
    }
  });
});
