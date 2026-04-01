import { test, expect } from "./fixtures";

// ============================================================
// Content & Publishing Pages E2E Tests
// ============================================================

test.describe("Content Manager", () => {
  test("loads content manager page", async ({ authedPage: page }) => {
    await page.goto("/content");
    await expect(page.locator("h1").filter({ hasText: /Content/ })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Prompt Manager", () => {
  test("loads prompt manager page", async ({ authedPage: page }) => {
    await page.goto("/prompts");
    await expect(page.locator("h1").filter({ hasText: /Prompt/ })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Publishing Center", () => {
  test("loads publishing center page", async ({ authedPage: page }) => {
    await page.goto("/publish");
    await expect(page.locator("h1").filter({ hasText: /Publish/ })).toBeVisible({ timeout: 15_000 });
  });
});
