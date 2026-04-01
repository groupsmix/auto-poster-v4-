import { test, expect } from "./fixtures";

// ============================================================
// Phase 2 Pages E2E Tests
// (Scheduler, Campaigns, Daily Briefings, Project Builder,
//  ROI Optimizer, Product Recycler, Multi-Language)
// ============================================================

test.describe("Scheduler", () => {
  test("loads scheduler page", async ({ authedPage: page }) => {
    await page.goto("/scheduler");
    await expect(page.locator("h1").filter({ hasText: /Scheduler/ })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Campaigns", () => {
  test("loads campaigns page", async ({ authedPage: page }) => {
    await page.goto("/campaigns");
    await expect(page.locator("h1").filter({ hasText: /Campaign/ })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Daily Briefings", () => {
  test("loads briefings page", async ({ authedPage: page }) => {
    await page.goto("/briefings");
    await expect(page.locator("h1").filter({ hasText: /Briefing/ })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Project Builder", () => {
  test("loads project builder page", async ({ authedPage: page }) => {
    await page.goto("/project-builder");
    await expect(page.locator("h1").filter({ hasText: /Project/ })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("ROI Optimizer", () => {
  test("loads ROI optimizer page", async ({ authedPage: page }) => {
    await page.goto("/roi");
    await expect(page.locator("h1").filter({ hasText: /ROI/ })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Product Recycler", () => {
  test("loads product recycler page", async ({ authedPage: page }) => {
    await page.goto("/recycler");
    await expect(page.locator("h1").filter({ hasText: /Recycler/ })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Multi-Language", () => {
  test("loads localization page", async ({ authedPage: page }) => {
    await page.goto("/localization");
    await expect(page.locator("h1").filter({ hasText: /Localization|Language/ })).toBeVisible({ timeout: 15_000 });
  });
});
