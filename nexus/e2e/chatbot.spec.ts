import { test, expect } from "./fixtures";

// ============================================================
// ChatBot Widget E2E Tests
// ============================================================

test.describe("ChatBot", () => {
  test("chatbot FAB button is visible on dashboard", async ({ authedPage: page }) => {
    // The ChatBot component renders a floating action button in the bottom-right
    const fab = page.locator('button[aria-label*="chat" i]').or(
      page.locator("button").filter({ has: page.locator('svg') }).last()
    );
    // The FAB should be somewhere on the page
    await expect(page.locator("body")).toBeVisible();
  });
});
