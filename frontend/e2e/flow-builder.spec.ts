import { test, expect } from "@playwright/test";

const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const ownerBotId = process.env.E2E_OWNER_BOT_ID;
const supabaseServiceKey = process.env.E2E_SUPABASE_SERVICE_KEY;
const standaloneBuilderUrl = process.env.NEXT_PUBLIC_FLOW_BUILDER_URL || "https://flow.personaliai.com";
const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.chatty.personaliai.com";

test.describe("standalone flow builder lifecycle", () => {
  test.skip(!ownerEmail || !ownerPassword || !ownerBotId, "requires E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD, and E2E_OWNER_BOT_ID");

  test("creates, publishes, pauses, resumes, and deletes a real workflow", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ownerEmail!);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    const onboardingSkip = page.getByRole("button", { name: "Skip", exact: true });
    await onboardingSkip.click({ force: true, timeout: 10_000 }).catch(() => undefined);
    await page.getByRole("heading", { name: "Set up your AI Assistant" }).waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);

    await page.getByRole("button", { name: "Automations", exact: true }).click();
    const automations = page.getByRole("region", { name: "Chatty automations" });
    await expect(automations).toBeVisible();

    const handoffResponse = page.waitForResponse((response) => response.url().includes("/api/flow-builder/handoff") && response.request().method() === "POST");
    await automations.getByRole("button", { name: /new workflow/i }).click();
    const handoff = await (await handoffResponse).json() as { handoff: string };
    const builder = await page.context().newPage();
    await builder.goto(`${standaloneBuilderUrl}/?bot_id=${encodeURIComponent(ownerBotId!)}&handoff=${encodeURIComponent(handoff.handoff)}`);
    await builder.waitForLoadState("domcontentloaded");
    await expect(builder.getByText("Chatty Flows", { exact: true })).toBeVisible();
    await expect(builder.getByText(/0\s+nodes/, { exact: false })).toBeVisible();

    await builder.getByRole("button", { name: /^Chatty event/ }).click();
    await builder.getByLabel("Event type").selectOption("session.started");
    await builder.getByRole("button", { name: /^HTTP request/ }).click();
    await builder.getByLabel("Adapter endpoint URL").fill("https://httpbin.org/status/204");
    const publishResponse = builder.waitForResponse((response) => response.url().includes("/api/flow-builder/publish") && response.request().method() === "POST");
    await builder.getByRole("button", { name: "Publish", exact: true }).click();
    const publishBody = await (await publishResponse).json() as { flow_id?: string };
    expect(publishBody.flow_id).toBeTruthy();
    await expect(builder.getByText(/Published v\d+/, { exact: false })).toBeVisible({ timeout: 15_000 });

    if (supabaseServiceKey) {
      const sessionId = `codex-flow-${Date.now()}`;
      const eventResponse = await fetch(`${apiUrl}/api/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: ownerBotId, session_id: sessionId, text: "flow acceptance", offline_ticket: true }),
      });
      expect(eventResponse.ok).toBeTruthy();
      const runsUrl = `https://dckjbkcormifiuwfpahj.supabase.co/rest/v1/chatty_flow_runs?flow_id=eq.${publishBody.flow_id}&select=status&order=created_at.desc&limit=1`;
      await expect.poll(async () => {
        const runsResponse = await fetch(runsUrl, { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } });
        const runs = await runsResponse.json() as Array<{ status?: string }>;
        return runs[0]?.status || "pending";
      }, { timeout: 30_000 }).toBe("completed");
    }
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
