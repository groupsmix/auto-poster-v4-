import { test, expect } from "@playwright/test";

// ============================================================
// Authentication / Login Gate E2E Tests
// ============================================================

test.describe("Login Gate", () => {
  test("shows login screen when no token is set", async ({ page }) => {
    await page.goto("/");
    // Should show the lock icon and login form
    await expect(page.locator("text=NEXUS")).toBeVisible();
    await expect(page.locator("text=Enter your dashboard secret to continue")).toBeVisible();
    await expect(page.locator('input[placeholder="Dashboard secret"]')).toBeVisible();
    await expect(page.locator("text=Unlock Dashboard")).toBeVisible();
    await expect(page.locator("text=This is the DASHBOARD_SECRET set on your Worker.")).toBeVisible();
  });

  test("shows error when submitting empty secret", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Unlock Dashboard").click();
    await expect(page.locator("text=Please enter the dashboard secret")).toBeVisible();
  });

  test("unlocks dashboard with correct secret", async ({ page }) => {
    const secret = process.env.DASHBOARD_SECRET || "147896325";
    await page.goto("/");

    await page.locator('input[placeholder="Dashboard secret"]').fill(secret);
    await page.locator("text=Unlock Dashboard").click();

    // Should navigate to the home page with sidebar visible
    await expect(page.locator("text=Welcome to NEXUS")).toBeVisible({ timeout: 15_000 });
  });

  test("persists session across page reload", async ({ page }) => {
    const secret = process.env.DASHBOARD_SECRET || "147896325";
    await page.goto("/");

    // Login
    await page.locator('input[placeholder="Dashboard secret"]').fill(secret);
    await page.locator("text=Unlock Dashboard").click();
    await expect(page.locator("text=Welcome to NEXUS")).toBeVisible({ timeout: 15_000 });

    // Reload and verify still logged in
    await page.reload();
    await expect(page.locator("text=Welcome to NEXUS")).toBeVisible({ timeout: 15_000 });
  });
});
