import { test, expect } from "@playwright/test";

// Golden-path E2E smoke suite (Chatty Test Strategy, Phase 3). Scope is
// deliberately narrow: things ONLY a real browser can catch - does the
// widget actually render, open, and round-trip a message; does the
// selected design actually paint. Deeper behavior (does a lead really
// land in the database, is a column missing) is already covered more
// reliably and much faster by tests/test_integration_live.py in the
// backend - scripting a full LLM conversation through UI clicks to
// re-prove that here would just be a slower, flakier duplicate.
const BOT_ID = "c8fa19c8-dd25-43a3-9c55-e8099e6f532e";

test.describe("widget golden path", () => {
  test("embed page opens and completes a message round-trip", async ({ page }) => {
    await page.goto(`/embed/${BOT_ID}`);

    // Embed opens on the Home tab by design; enter the Chat surface before
    // asserting the composer is available.
    await page.getByText("Chat", { exact: true }).last().click();
    const input = page.getByPlaceholder("Compose your message…");
    await expect(input).toBeVisible({ timeout: 15_000 });

    await input.fill("What does this product do?");
    await input.press("Enter");

    // The visitor's own message should render immediately (no round-trip needed).
    await expect(page.getByText("What does this product do?")).toBeVisible();

    // The assistant's reply is a real Gemini call - give it real time, but
    // this is exactly the round-trip a visitor experiences, worth proving
    // end to end rather than mocking away.
    const replies = page.locator(".bot-bubble");
    await expect(replies).toHaveCount(2, { timeout: 30_000 }); // welcome message + this reply
  });

  test("selected design actually paints on the live widget", async ({ page }) => {
    await page.goto(`/embed/${BOT_ID}`);

    const container = page.locator('[class*="style-"]').first();
    await expect(container).toBeVisible();

    const className = await container.getAttribute("class");
    expect(className).toMatch(/style-(minimal|playful|corporate|dark-sleek|gradient-glow|glassmorphism|ecommerce|healthcare-calm|neubrutalism|luxury-editorial)/);

    // A container with no matching design CSS falls back to transparent -
    // any real design applies a solid or gradient background.
    const bg = await container.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("landing page launcher", () => {
  test("floating launcher opens the embedded widget panel", async ({ page }) => {
    await page.goto("/");

    const launcher = page.getByTitle("Chat Assistant");
    await expect(launcher).toBeVisible({ timeout: 10_000 });
    await launcher.click();
    // The launcher opens on the configured Home tab; enter Chat before
    // asserting the composer, matching the visitor flow in the widget UI.
    const host = page.locator("#chatty-widget-host");
    const chatTab = host.getByRole("button", { name: "Chat", exact: true });
    if (await chatTab.count()) await chatTab.click();

    // The production loader has shipped both direct Shadow-DOM and
    // iframe-backed panel implementations. Validate the user-visible composer
    // through either supported transport without coupling the smoke test to
    // one DOM shape.
    await expect.poll(async () => {
      if (await host.locator("textarea").count()) {
        return await host.locator("textarea").last().isVisible();
      }
      const iframe = host.locator("iframe").first();
      if (await iframe.count()) {
        const frame = await iframe.contentFrame();
        return frame ? await frame.getByPlaceholder("Compose your message…").isVisible() : false;
      }
      return false;
    }, { timeout: 10_000 }).toBe(true);
  });
});

// Owner-side golden path: sign in, change a design, confirm it saves and
// the live widget reflects it. Needs a real dashboard login, which isn't
// something to hardcode - set E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD to run
// this locally or in CI; it skips cleanly without them rather than failing.
const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;

test.describe("owner golden path", () => {
  test.skip(!ownerEmail || !ownerPassword, "requires E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD");

  test("picking a design in the Customizer saves and reflects on the live widget", async ({ page }) => {
    test.setTimeout(60_000);
    // The production account is shared by smoke runs. Do not inherit a stale
    // active-bot selection from a prior role/permission test run.
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ownerEmail!);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    // Prefer the same canonical bot used by the public widget smoke test. The
    // owner fixture can contain inbox-only team bots; choosing by id avoids
    // accidentally exercising a read-only/shared bot whose style cannot be
    // persisted.
    const botSelector = page.getByText("Active Chatbot", { exact: true }).locator("..").getByRole("button");
    await botSelector.click();
    const botOptions = page.locator('[data-chatbot-option="true"]');
    const canonicalOption = page.locator(`[data-chatbot-option="true"][data-bot-id="${BOT_ID}"]`);
    const canonicalName = await canonicalOption.count() ? (await canonicalOption.textContent())?.trim() : null;
    if (await canonicalOption.count()) await canonicalOption.click();
    // If the public smoke bot is not owned by this account, retain the
    // dashboard's already-selected owner bot. Picking an arbitrary team bot
    // can make a valid persistence check look like a save regression.
    // The picker is a popover with a full-screen click-away layer. Close it
    // explicitly before navigating so a delayed bot switch cannot leave the
    // overlay intercepting the next sidebar action.
    await page.locator("div.fixed.inset-0.bg-transparent").click({ position: { x: 4, y: 4 } });
    await expect(botOptions.first()).toBeHidden();
    if (canonicalName) await expect(botSelector).toContainText(canonicalName, { timeout: 15_000 });
    await page.getByRole("button", { name: "Customizer", exact: true }).click();

    // Pick whichever design isn't already selected, so the test proves an
    // actual change round-trips rather than a no-op save.
    const previewFrame = page.frameLocator('iframe[src*="/embed/"]');
    const current = await previewFrame.locator('[class*="style-"]').first().getAttribute("class");
    const target = current?.includes("minimal") ? "Playful" : "Minimal";
    // Let the initial bot hydration finish so the assertion below observes
    // the save caused by this interaction, not an earlier hydration toast.
    await page.waitForTimeout(2_000);
    await page.getByText(target, { exact: true }).click();
    await expect(previewFrame.locator(`[class*="style-${target.toLowerCase()}"]`).first()).toBeVisible({ timeout: 10_000 });

    // The toast is transient and can be replaced by a later background save.
    // Verify the durable behavior below instead of coupling this regression
    // test to notification timing.
    await page.waitForTimeout(2_500);

    await page.reload({ waitUntil: "domcontentloaded" });
    // A dashboard refresh restores the default tab, so reopen Customizer
    // before asserting the persisted preview state.
    await page.getByRole("button", { name: "Customizer", exact: true }).click();
    const livePreview = page.locator('iframe[src*="/embed/"]');
    await expect(livePreview).toHaveCount(1, { timeout: 20_000 });
    await expect(livePreview).toBeVisible({ timeout: 20_000 });
    // The dashboard and embed load independently after a refresh. Wait for
    // the embed document's root style marker instead of reading a detached
    // frame immediately after the parent navigation completes.
    const savedClassLocator = livePreview.contentFrame().locator('[class*="style-"]').first();
    await expect(savedClassLocator).toHaveAttribute("class", /style-/, { timeout: 40_000 });
    const savedClass = await savedClassLocator.getAttribute("class");
    expect(savedClass?.toLowerCase()).toContain(target.toLowerCase());
  });

  test("Flow Builder and Campaigns remain reachable as production dashboard surfaces", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ownerEmail!);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // The industrial workspace must expose an accessible collapse control so
    // operators can reclaim canvas space without losing navigation.
    const collapse = page.getByRole("button", { name: /collapse sidebar/i });
    await expect(collapse).toBeVisible();
    await collapse.click();
    await expect(page.getByRole("button", { name: /expand sidebar/i })).toBeVisible();
    await page.getByRole("button", { name: /expand sidebar/i }).click();

    await page.getByRole("button", { name: "Flow Builder", exact: true }).click();
    await expect(page.getByText("Visual Flow Builder", { exact: true })).toBeVisible();
    const toolboxCollapse = page.getByRole("button", { name: /collapse flow toolbox/i });
    await expect(toolboxCollapse).toBeVisible();
    await toolboxCollapse.click();
    await expect(page.getByRole("button", { name: /expand flow toolbox/i })).toBeVisible();
    await page.getByRole("button", { name: /expand flow toolbox/i }).click();
    await expect(page.getByRole("button", { name: /run dry test/i })).toBeVisible();
    await page.getByText("Test data & mapping context", { exact: true }).click();
    await expect(page.getByLabel("Visitor inputs")).toBeVisible();
    await expect(page.getByLabel("Context JSON")).toBeVisible();
    await expect(page.getByRole("button", { name: /view execution history/i })).toBeVisible();
    await page.getByRole("button", { name: /view execution history/i }).click();
    // The dashboard uses the accessible ModernSelect trigger (a button with
    // a listbox popup), not a native <select>/combobox. Keep this assertion
    // aligned with the production control so the test verifies the real
    // keyboard/portal-based selector rather than an obsolete role.
    const runStatusFilter = page.getByRole("button", { name: "Execution status filter" });
    await expect(runStatusFilter).toBeVisible();
    await runStatusFilter.click();
    await page.getByRole("option", { name: "Failed", exact: true }).click();
    await expect(runStatusFilter).toContainText("Failed");
    await page.getByRole("button", { name: "Campaigns", exact: true }).click();
    await expect(page.getByText("Proactive Campaigns", { exact: true })).toBeVisible();
    await expect(page.getByText("AI campaign copilot", { exact: true })).toBeVisible();
    await expect(page.getByText("Start window", { exact: true })).toBeVisible();
    await expect(page.getByText("End window", { exact: true })).toBeVisible();
  });

  test("mobile dashboard exposes the navigation and responsive automation surfaces", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ownerEmail!);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    const openSidebar = page.getByRole("button", { name: "Open dashboard sidebar" });
    await expect(openSidebar).toBeVisible();
    await openSidebar.click();
    await expect(page.getByRole("button", { name: "Close sidebar" })).toBeVisible();

    await page.getByRole("button", { name: "Flow Builder", exact: true }).click();
    await expect(page.getByText("Visual Flow Builder", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open dashboard sidebar" }).click();
    await expect(page.getByRole("button", { name: "Close sidebar" })).toBeVisible();
    await page.getByRole("button", { name: "Campaigns", exact: true }).click();
    await expect(page.getByText("Proactive Campaigns", { exact: true })).toBeVisible();
  });
});
