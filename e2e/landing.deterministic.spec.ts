import { expect, test } from "@playwright/test";

test.describe("landing page deterministic checks", () => {
  test("renders the help center and all operating guides", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Build a bot people trust" })).toBeVisible();
    await expect(page.locator("#help-center article")).toHaveCount(6);
    await expect(page.getByRole("link", { name: "Help center" }).first()).toHaveAttribute("href", "#help-center");
  });

  test("keeps the support navigation usable without external services", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Help center" }).first().click();
    await expect(page.locator("#help-center")).toBeInViewport();
    await expect(page.getByRole("link", { name: "Browse documentation" })).toHaveAttribute("href", "https://docs.chatty.personaliai.com");
  });
});
