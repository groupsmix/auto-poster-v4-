import { test, expect } from "./fixtures";

// ============================================================
// Sidebar Navigation E2E Tests
// ============================================================

test.describe("Sidebar Navigation", () => {
  test("sidebar displays all navigation sections", async ({ authedPage: page }) => {
    // WORKFLOW section
    await expect(page.locator("nav >> text=Home").first()).toBeVisible();
    await expect(page.locator("nav >> text=Products").first()).toBeVisible();
    await expect(page.locator("nav >> text=Review Center").first()).toBeVisible();
    await expect(page.locator("nav >> text=Publishing Center").first()).toBeVisible();

    // CONTENT section
    await expect(page.locator("nav >> text=Content Manager").first()).toBeVisible();
    await expect(page.locator("nav >> text=Prompt Manager").first()).toBeVisible();

    // CONFIGURATION section
    await expect(page.locator("nav >> text=AI Manager").first()).toBeVisible();
    await expect(page.locator("nav >> text=Platform Manager").first()).toBeVisible();
    await expect(page.locator("nav >> text=Social Channels").first()).toBeVisible();
    await expect(page.locator("nav >> text=Domains & Categories").first()).toBeVisible();
  });

  test("navigates to Products page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Products").first().click();
    await expect(page).toHaveURL(/\/products/);
    await expect(page.locator("h1:text('Products')")).toBeVisible();
  });

  test("navigates to Review Center page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Review Center").first().click();
    await expect(page).toHaveURL(/\/review/);
    await expect(page.locator("h1:text('Review Center')")).toBeVisible();
  });

  test("navigates to Publishing Center page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Publishing Center").first().click();
    await expect(page).toHaveURL(/\/publish/);
  });

  test("navigates to Content Manager page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Content Manager").first().click();
    await expect(page).toHaveURL(/\/content/);
  });

  test("navigates to Prompt Manager page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Prompt Manager").first().click();
    await expect(page).toHaveURL(/\/prompts/);
  });

  test("navigates to AI Manager page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=AI Manager").first().click();
    await expect(page).toHaveURL(/\/ai-manager/);
    await expect(page.locator("h1:text('AI Manager')")).toBeVisible();
  });

  test("navigates to Platform Manager page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Platform Manager").first().click();
    await expect(page).toHaveURL(/\/platforms/);
    await expect(page.getByRole("heading", { name: "Platform Manager" }).first()).toBeVisible();
  });

  test("navigates to Social Channels page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Social Channels").first().click();
    await expect(page).toHaveURL(/\/social/);
  });

  test("navigates to Domains & Categories page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Domains & Categories").first().click();
    await expect(page).toHaveURL(/\/domains/);
  });

  test("navigates to Settings page", async ({ authedPage: page }) => {
    // Settings is at the bottom of the sidebar
    await page.locator("nav >> text=Settings").first().click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test("navigates back to Home", async ({ authedPage: page }) => {
    // First go to Products
    await page.locator("nav >> text=Products").first().click();
    await expect(page).toHaveURL(/\/products/);

    // Then go back to Home
    await page.locator("nav >> text=Home").first().click();
    await expect(page.locator("text=Welcome to NEXUS")).toBeVisible();
  });

  test("highlights active navigation item", async ({ authedPage: page }) => {
    // Navigate to Products and check active state
    await page.locator("nav >> text=Products").first().click();
    await expect(page).toHaveURL(/\/products/);

    // The Products link should have the active styling (bg-accent)
    const productsLink = page.locator("nav a[href='/products']").first();
    await expect(productsLink).toHaveClass(/bg-accent/);
  });
});

test.describe("Sidebar Phase 2 Pages", () => {
  test("navigates to Scheduler page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Scheduler").first().click();
    await expect(page).toHaveURL(/\/scheduler/);
  });

  test("navigates to Campaigns page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Campaigns").first().click();
    await expect(page).toHaveURL(/\/campaigns/);
  });

  test("navigates to Daily Briefings page", async ({ authedPage: page }) => {
    await page.locator("nav >> text=Daily Briefings").first().click();
    await expect(page).toHaveURL(/\/briefings/);
  });
});
