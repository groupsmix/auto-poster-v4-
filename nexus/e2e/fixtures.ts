import { test as base, expect } from "@playwright/test";

/**
 * Shared fixtures for NEXUS E2E tests.
 *
 * `authedPage` — a Page that has already unlocked the dashboard by
 * injecting the DASHBOARD_SECRET into localStorage before navigation.
 */
export const test = base.extend<{ authedPage: import("@playwright/test").Page }>({
  authedPage: async ({ page }, use) => {
    const secret = process.env.DASHBOARD_SECRET || "147896325";

    // Navigate to the app root so we can set localStorage on the correct origin
    await page.goto("/");

    // Inject the dashboard secret into localStorage to bypass the login gate
    await page.evaluate((s) => {
      localStorage.setItem("nexus_token", s);
      window.dispatchEvent(new Event("nexus-token-change"));
    }, secret);

    // Reload so the app picks up the token
    await page.reload();

    // Wait for the sidebar to appear — indicates successful auth
    await page.waitForSelector('text="NEXUS"', { timeout: 15_000 });

    await use(page);
  },
});

export { expect };
