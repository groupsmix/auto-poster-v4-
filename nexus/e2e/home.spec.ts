import { test, expect } from "./fixtures";

// ============================================================
// Home Page E2E Tests
// ============================================================

test.describe("Home Page", () => {
  test("displays welcome heading and subtitle", async ({ authedPage: page }) => {
    await expect(page.locator("text=Welcome to NEXUS")).toBeVisible();
    await expect(page.locator("text=Select a domain to get started")).toBeVisible();
  });

  test("shows onboarding guide on first visit", async ({ page }) => {
    const secret = process.env.DASHBOARD_SECRET || "147896325";
    await page.goto("/");

    // Clear onboarding dismissal state
    await page.evaluate((s) => {
      localStorage.removeItem("nexus_onboarding_dismissed");
      localStorage.setItem("nexus_token", s);
      window.dispatchEvent(new Event("nexus-token-change"));
    }, secret);
    await page.reload();
    await page.waitForSelector("text=Welcome to NEXUS", { timeout: 15_000 });

    // Onboarding guide should be visible
    await expect(page.locator("text=How NEXUS works")).toBeVisible();
    await expect(page.locator("text=Pick a domain")).toBeVisible();
    await expect(page.locator("text=Choose a category")).toBeVisible();
    await expect(page.locator("text=CEO Review")).toBeVisible();
  });

  test("dismisses onboarding guide", async ({ page }) => {
    const secret = process.env.DASHBOARD_SECRET || "147896325";
    await page.goto("/");

    await page.evaluate((s) => {
      localStorage.removeItem("nexus_onboarding_dismissed");
      localStorage.setItem("nexus_token", s);
      window.dispatchEvent(new Event("nexus-token-change"));
    }, secret);
    await page.reload();
    await page.waitForSelector("text=Welcome to NEXUS", { timeout: 15_000 });

    // Dismiss onboarding
    await page.locator('button[aria-label="Dismiss onboarding guide"]').click();

    // Onboarding should be hidden
    await expect(page.locator("text=How NEXUS works")).not.toBeVisible();
  });

  test("shows Add New Domain card", async ({ authedPage: page }) => {
    await expect(page.locator("text=Add New Domain")).toBeVisible();
  });

  test("opens Add Domain modal when clicking Add New Domain", async ({ authedPage: page }) => {
    await page.locator("text=Add New Domain").click();

    // Modal should appear — look for the modal dialog or an input field
    await expect(
      page.locator('[role="dialog"]')
        .or(page.locator('input[placeholder*="domain" i]'))
        .or(page.locator('input[placeholder*="name" i]'))
        .first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
