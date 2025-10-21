import { test, expect } from "@playwright/test";

test.describe("Merch Watcher admin", () => {
  test("login bypass and crawler settings persist", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Merch Watcher")).toBeVisible();

    await page.goto("/admin/crawler");
    await expect(page.locator("text=Crawler settings")).toBeVisible();

    const maxItems = page.locator("#max-items");
    await maxItems.fill("275");
    await page.getByRole("button", { name: /save settings/i }).click();
    await expect(page.locator("text=Settings saved")).toBeVisible();

    await page.reload();
    await expect(maxItems).toHaveValue("275");
  });
});
