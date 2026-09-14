import { expect, test } from "@playwright/test";

test.describe("landing page deterministic checks", () => {
  test("renders the redesigned landing page and SEO FAQ content", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Power AI customer support with grounded business data/i }),
    ).toBeVisible();
    await expect(page.locator("#faq button")).toHaveCount(6);
    await expect(page.getByRole("link", { name: "Docs" }).first()).toHaveAttribute(
      "href",
      "https://docs.chatty.personaliai.com",
    );
  });

  test("keeps the main navigation usable without external services", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Capabilities" }).first().click();
    await expect(page.locator("#capabilities")).toBeInViewport();
    await page.getByRole("link", { name: "Setup for agents (MCP)" }).click();
    await expect(page.locator("#mcp")).toBeInViewport();
  });
});
