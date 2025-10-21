import { test, expect } from "@playwright/test";

test.describe("Merch Watcher", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Merch Watcher")).toBeVisible();
  });

  test("signup link visible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("a", { hasText: "Create one" })).toBeVisible();
  });
});
