import { test, expect } from "./fixtures";

// ============================================================
// Products Page E2E Tests
// ============================================================

test.describe("Products Page", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/products");
    await page.waitForSelector("h1:text('Products')", { timeout: 15_000 });
  });

  test("displays page heading and subtitle", async ({ authedPage: page }) => {
    await expect(page.locator("h1:text('Products')")).toBeVisible();
    await expect(page.locator("text=All products with status and filtering")).toBeVisible();
  });

  test("shows search input", async ({ authedPage: page }) => {
    await expect(page.locator('input[placeholder="Search products..."]')).toBeVisible();
  });

  test("shows status filter dropdown", async ({ authedPage: page }) => {
    const statusSelect = page.locator("select").filter({ hasText: "All Statuses" });
    await expect(statusSelect).toBeVisible();

    // Verify status options exist
    const options = statusSelect.locator("option");
    await expect(options).toHaveCount(8); // All, Draft, Running, Pending Review, Approved, In Revision, Published, Cancelled
  });

  test("shows More Filters button", async ({ authedPage: page }) => {
    await expect(page.locator("text=More filters").first()).toBeVisible();
  });

  test("toggles additional filters when clicking More Filters", async ({ authedPage: page }) => {
    await page.locator("text=More filters").first().click();

    // Additional filter dropdowns should appear
    await expect(page.locator("select").filter({ hasText: "All Domains" })).toBeVisible();
    await expect(page.locator("select").filter({ hasText: "All Categories" })).toBeVisible();
  });

  test("shows Flat List / Batch View toggle", async ({ authedPage: page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flat List|Batch View/ });
    await expect(toggle).toBeVisible();
  });

  test("toggles between Flat List and Batch View", async ({ authedPage: page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flat List|Batch View/ });

    // Initially should say "Flat List"
    await expect(toggle).toHaveText("Flat List");

    // Click to toggle
    await toggle.click();
    await expect(toggle).toHaveText("Batch View");

    // Click again to toggle back
    await toggle.click();
    await expect(toggle).toHaveText("Flat List");
  });

  test("shows product count", async ({ authedPage: page }) => {
    // Should show "X products" or "0 products"
    await expect(page.locator("text=/\\d+ products?/")).toBeVisible();
  });

  test("shows empty state when no products match", async ({ authedPage: page }) => {
    // Search for something that won't match
    await page.locator('input[placeholder="Search products..."]').fill("xyznonexistent12345");
    await expect(page.locator("text=No products match your filters.")).toBeVisible({ timeout: 5_000 });
  });

  test("search filters products in real-time", async ({ authedPage: page }) => {
    const searchInput = page.locator('input[placeholder="Search products..."]');
    await searchInput.fill("test");

    // Wait for filtering to take effect
    await page.waitForTimeout(500);

    // The product count should update (may be 0 or more)
    await expect(page.locator("text=/\\d+ products?/")).toBeVisible();
  });
});
