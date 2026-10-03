import { expect, test } from "@playwright/test";
import path from "node:path";

test("mobile widget clears composer and private history on identify/logout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let counter = 0;
  const identityRequests: string[] = [];
  await page.route("**/api/widget/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/widget/identity") {
      counter++;
      identityRequests.push(route.request().postData() || "");
      await route.fulfill({ json: { visitor_token: String(counter).repeat(43), session_id: `ci-${String(counter).repeat(8)}-aaaa-4aaa-aaaa-aaaaaaaaaaaa`, expires_at: "2099-01-01" } });
    } else if (url.pathname === "/api/widget/identity/logout") {
      expect(route.request().headers()["x-chatty-visitor"]).toBeTruthy();
      await route.fulfill({ json: { ok: true } });
    } else if (url.pathname.endsWith("/theme")) {
      await route.fulfill({ json: { name: "Identity test", welcome_message: "Welcome", primary_color: "#f97316", widget_style: "minimal", voice_enabled: false, csat_enabled: false } });
    } else if (url.pathname.endsWith("/live")) {
      await route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" });
    } else {
      await route.fulfill({ json: { messages: [], conversations: [], campaigns: [], categories: [], ai_paused: false } });
    }
  });
  await page.route("https://identity-fixture.test/", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="identity-widget-fixture"></div></body></html>' }));
  await page.goto("https://identity-fixture.test/", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ path: path.resolve("public/chatty-app.css") });
  await page.addScriptTag({ path: path.resolve("public/chatty-app.js") });
  await page.evaluate(() => {
    const target = window as typeof window & { ChattyDOM: { mount: (node: HTMLElement, options: unknown) => void }; identityTestApi?: unknown };
    target.ChattyDOM.mount(document.getElementById("identity-widget-fixture")!, {
      botId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", teaserEnabled: false,
      onApiReady: (api: unknown) => { target.identityTestApi = api; },
    });
  });
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { identityTestApi?: unknown }).identityTestApi))).toBe(true);
  async function command(name: "open" | "identify" | "logout") {
    await page.evaluate(async commandName => {
      const api = (window as unknown as { identityTestApi: { open: () => void; identify: (token: string) => Promise<void>; logout: () => Promise<void> } }).identityTestApi;
      if (commandName === "identify") await api.identify("server-signed-test-token");
      else await api[commandName]();
    }, name);
  }
  await command("open");
  await page.getByText("Chat", { exact: true }).last().click();
  const composer = page.getByPlaceholder("Compose your message…");
  await composer.fill("Previous customer's unsent private draft");
  await command("identify");
  await page.getByText("Chat", { exact: true }).last().click();
  await expect(composer).toHaveValue("");
  await composer.fill("Verified customer's private draft");
  await command("logout");
  await page.getByText("Chat", { exact: true }).last().click();
  await expect(composer).toHaveValue("");
  expect(identityRequests.some(body => body.includes("server-signed-test-token"))).toBe(true);
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain("server-signed-test-token");
  expect(stored).not.toContain("private draft");
});
