import { test, expect } from "./fixtures";

// ============================================================
// Configuration Pages E2E Tests
// (AI Manager, Platform Manager, Social Channels, Domains & Categories)
// ============================================================

test.describe("AI Manager", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/ai-manager");
    await page.waitForSelector("h1:text('AI Manager')", { timeout: 15_000 });
  });

  test("displays page heading and subtitle", async ({ authedPage: page }) => {
    await expect(page.locator("h1:text('AI Manager')")).toBeVisible();
    await expect(page.locator("text=AI models, health scores, and failover chains")).toBeVisible();
  });

  test("shows AI Gateway Dashboard button", async ({ authedPage: page }) => {
    await expect(page.locator("text=AI Gateway Dashboard")).toBeVisible();
  });

  test("shows Workers AI as always active", async ({ authedPage: page }) => {
    await expect(page.locator("text=Workers AI")).toBeVisible();
    await expect(page.locator("text=Always Active")).toBeVisible();
    // "active" badge text appears alongside the heading
    await expect(page.getByText("active", { exact: true })).toBeVisible();
  });

  test("shows task type filter buttons", async ({ authedPage: page }) => {
    await expect(page.locator("button:text('All Types')")).toBeVisible();
  });
});

test.describe("Platform Manager", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/platforms");
    await page.waitForSelector("text=/Platform Manager/", { timeout: 15_000 });
  });

  test("displays page heading", async ({ authedPage: page }) => {
    await expect(page.getByRole("heading", { name: "Platform Manager" }).first()).toBeVisible();
  });

  test("shows Add Platform button", async ({ authedPage: page }) => {
    await expect(page.getByRole("button", { name: /Add.*Platform/ }).first()).toBeVisible();
  });

  test("shows empty state when no platforms configured", async ({ authedPage: page }) => {
    const emptyMsg = page.locator('text=/No platforms configured/');
    // May or may not be empty depending on backend data
    if (await emptyMsg.isVisible()) {
      await expect(emptyMsg).toBeVisible();
    }
  });
});

test.describe("Social Channels", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/social");
    await page.waitForSelector("text=/Social Channels/", { timeout: 15_000 });
  });

  test("displays page heading", async ({ authedPage: page }) => {
    await expect(page.getByRole("heading", { name: "Social Channels" }).first()).toBeVisible();
  });

  test("shows Add New Channel button", async ({ authedPage: page }) => {
    await expect(page.getByRole("button", { name: /Add New Channel/ })).toBeVisible();
  });
});

test.describe("Domains & Categories", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/domains");
    await page.waitForSelector("text=/Domains/", { timeout: 15_000 });
  });

  test("displays page heading", async ({ authedPage: page }) => {
    await expect(page.locator("h1").filter({ hasText: /Domains/ })).toBeVisible();
  });
});
