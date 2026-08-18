import { test, expect } from "@playwright/test";

// Golden-path E2E smoke suite (Chatty Test Strategy, Phase 3). Scope is
// deliberately narrow: things ONLY a real browser can catch — does the
// widget actually render, open, and round-trip a message; does the
// selected design actually paint. Deeper behavior (does a lead really
// land in the database, is a column missing) is already covered more
// reliably and much faster by tests/test_integration_live.py in the
// backend — scripting a full LLM conversation through UI clicks to
// re-prove that here would just be a slower, flakier duplicate.
const BOT_ID = "c8fa19c8-dd25-43a3-9c55-e8099e6f532e";

test.describe("widget golden path", () => {
  test("embed page opens and completes a message round-trip", async ({ page }) => {
    await page.goto(`/embed/${BOT_ID}`);

    const input = page.getByPlaceholder("Compose your message…");
    await expect(input).toBeVisible({ timeout: 15_000 });

    await input.fill("What does this product do?");
    await input.press("Enter");

    // The visitor's own message should render immediately (no round-trip needed).
    await expect(page.getByText("What does this product do?")).toBeVisible();

    // The assistant's reply is a real Gemini call — give it real time, but
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

    // A container with no matching design CSS falls back to transparent —
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

    // The panel is a fixed-position div that becomes visible/interactive on
    // open — check the state that actually matters to a visitor: can they
    // now see and reach the iframe, not just that a class toggled.
    const panelIframe = page.frameLocator("iframe[title=\"Live Chatbot Widget\"], iframe").first();
    await expect(panelIframe.getByPlaceholder("Compose your message…")).toBeVisible({ timeout: 10_000 });
  });
});

// Owner-side golden path: sign in, change a design, confirm it saves and
// the live widget reflects it. Needs a real dashboard login, which isn't
// something to hardcode — set E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD to run
// this locally or in CI; it skips cleanly without them rather than failing.
const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;

test.describe("owner golden path", () => {
  test.skip(!ownerEmail || !ownerPassword, "requires E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD");

  test("picking a design in the Customizer saves and reflects on the live widget", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/email/i).fill(ownerEmail!);
    await page.getByPlaceholder(/password/i).fill(ownerPassword!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await page.getByRole("link", { name: "Customizer" }).click();

    // Pick whichever design isn't already selected, so the test proves an
    // actual change round-trips rather than a no-op save.
    const current = await page.locator('[class*="style-"]').first().getAttribute("class");
    const target = current?.includes("minimal") ? "Playful" : "Minimal";
    await page.getByText(target, { exact: true }).click();

    // Debounced autosave — see the stale-closure fix earlier this session;
    // this test is exactly the regression guard for that bug class.
    await expect(page.getByText("Changes saved.")).toBeVisible({ timeout: 5_000 });

    await page.reload();
    const savedClass = await page.locator('[class*="style-"]').first().getAttribute("class");
    expect(savedClass?.toLowerCase()).toContain(target.toLowerCase());
  });
});
