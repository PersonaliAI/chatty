import { test, expect } from "@playwright/test";

const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const ownerBotId = process.env.E2E_OWNER_BOT_ID;

test.describe("standalone flow builder lifecycle", () => {
  test.skip(!ownerEmail || !ownerPassword || !ownerBotId, "requires E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD, and E2E_OWNER_BOT_ID");

  test("creates, publishes, pauses, resumes, and deletes a real workflow", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ownerEmail!);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    await page.getByRole("button", { name: "Automations", exact: true }).click();
    const automations = page.getByRole("region", { name: "Chatty automations" });
    await expect(automations).toBeVisible();

    const popupPromise = page.waitForEvent("popup");
    await automations.getByRole("button", { name: /new workflow/i }).click();
    const builder = await popupPromise;
    await builder.waitForLoadState("domcontentloaded");
    await expect(builder.getByText("Chatty Flows", { exact: true })).toBeVisible();
    await expect(builder.getByText(/0\s+nodes/, { exact: false })).toBeVisible();

    await builder.getByRole("button", { name: /^Chatty event/ }).click();
    await builder.getByRole("button", { name: /^HTTP request/ }).click();
    await builder.getByLabel("Adapter endpoint URL").fill("https://httpbin.org/status/204");
    await builder.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(builder.getByText(/Published v\d+/, { exact: false })).toBeVisible({ timeout: 15_000 });
    await builder.close();

    await page.reload();
    await page.getByRole("button", { name: "Automations", exact: true }).click();
    const row = page.locator(".flow-row").filter({ hasText: "New workflow" }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: /pause/i }).click();
    await expect(page.getByText("Automation paused.", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: /resume/i }).click();
    await expect(page.getByText("Automation resumed.", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: /more workflow actions/i }).click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: /delete workflow/i }).click();
    await expect(page.getByText("Automation deleted.", { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
