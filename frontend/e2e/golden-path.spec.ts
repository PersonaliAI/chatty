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
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ownerEmail!);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Customizer", exact: true }).click();

    // Pick whichever design isn't already selected, so the test proves an
    // actual change round-trips rather than a no-op save.
    const previewFrame = page.frameLocator('iframe[src*="/embed/"]');
    const current = await previewFrame.locator('[class*="style-"]').first().getAttribute("class");
    const target = current?.includes("minimal") ? "Playful" : "Minimal";
    await page.getByText(target, { exact: true }).click();

    // Debounced autosave - see the stale-closure fix earlier this session;
    // this test is exactly the regression guard for that bug class.
    await expect(page.getByText("Changes saved.")).toBeVisible({ timeout: 5_000 });

    await page.reload();
    const savedClass = await page.frameLocator('iframe[src*="/embed/"]').locator('[class*="style-"]').first().getAttribute("class");
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
    const runStatusFilter = page.getByRole("combobox", { name: "Execution status filter" });
    await expect(runStatusFilter).toBeVisible();
    await runStatusFilter.selectOption("failed");
    await expect(runStatusFilter).toHaveValue("failed");
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
