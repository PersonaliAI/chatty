import { expect, test, type Page } from "@playwright/test";

const BOT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

async function mockVoiceBackend(page: Page) {
  await page.context().route("**/api/widget/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith("/theme")) {
      await route.fulfill({
        json: {
          id: BOT_ID,
          name: "Voice test assistant",
          welcome_message: "Hello from the voice test assistant.",
          primary_color: "#f97316",
          widget_style: "minimal",
          csat_enabled: false,
          voice_enabled: true,
          voice_visualizer: "wave",
          calendar_scheduling_enabled: true,
          team_profiles: [],
        },
      });
      return;
    }

    if (url.pathname.endsWith("/identity")) {
      await route.fulfill({
        json: {
          visitor_token: "v".repeat(43),
          session_id: "ci-aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
          expires_at: "2099-01-01T00:00:00.000Z",
        },
      });
      return;
    }

    if (url.pathname.includes("/booking/slots")) {
      await route.fulfill({
        json: {
          enabled: true,
          provider: "google_meet",
          duration_minutes: 30,
          available_dates: ["2030-01-02"],
          slots_by_date: {
            "2030-01-02": [
              {
                start: "2030-01-02T09:00:00.000Z",
                end: "2030-01-02T09:30:00.000Z",
                time_label: "9:00 AM",
                visitor_local_label: "9:00 AM",
              },
            ],
          },
          lead_fields: ["name", "email"],
          lead_required_fields: ["name", "email"],
          booking_email_verification: true,
        },
      });
      return;
    }

    if (url.pathname.endsWith("/voice/token")) {
      await route.fulfill({
        json: {
          serverUrl: "wss://voice-test.invalid",
          participantToken: "test-token",
          roomName: "chatty-test-room",
          participantName: "Visitor",
        },
      });
      return;
    }

    if (url.pathname.endsWith("/live")) {
      await route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" });
      return;
    }

    await route.fulfill({
      json: { messages: [], conversations: [], campaigns: [], categories: [], ai_paused: false },
    });
  });
}

test("voice entry points open the standalone surface without replacing chat", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await mockVoiceBackend(page);

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`/embed/${BOT_ID}?test=voice-ui`, { waitUntil: "domcontentloaded" });
  const waveHeader = page.getByRole("button", { name: "Open voice agent in a new window" });
  await expect(waveHeader).toBeVisible({ timeout: 30_000 });

  const popupPromise = page.waitForEvent("popup");
  await waveHeader.click();
  const popup = await popupPromise;
  const popupErrors: string[] = [];
  popup.on("pageerror", (error) => popupErrors.push(error.message));
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.getByRole("button", { name: "Start voice conversation" })).toBeVisible();
  await expect(popup.getByText("Ready to talk").first()).toBeVisible();

  await expect(popup.getByRole("button", { name: "Show transcript" })).toBeVisible();
  await popup.getByRole("button", { name: "Show transcript" }).click();
  await expect(popup.getByText("Live transcript", { exact: true })).toBeVisible();
  await expect(popup.getByText("Start the voice agent to see real-time transcription here.")).toBeVisible();

  await expect(popup.getByRole("button", { name: "Book a meeting" })).toBeVisible();
  const slotsResponse = popup.waitForResponse((response) => response.url().includes("/api/widget/booking/slots") && response.ok());
  await popup.getByRole("button", { name: "Book a meeting" }).click();
  await expect(popup.getByRole("button", { name: "Hide booking" })).toBeVisible();
  await expect(popup.getByText("Choose a slot or tell the agent what works.")).toBeVisible();
  await slotsResponse;
  await expect(popup.getByRole("button", { name: /^\d{1,2}:\d{2} (?:AM|PM)$/ })).toBeVisible({ timeout: 15_000 });

  await popup.close();
  await expect(waveHeader).toBeVisible();
  await expect(waveHeader).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to chat" })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(popupErrors).toEqual([]);
});

test("landing hero voice CTA opens the full voice agent in an in-page modal", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await mockVoiceBackend(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const talkButton = page.getByRole("button", { name: "Talk to Chatty" });
  await expect(talkButton).toBeVisible({ timeout: 30_000 });
  await talkButton.click();

  const modal = page.getByRole("dialog", { name: "Chatty voice agent" });
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await expect(modal.getByRole("button", { name: "Voice language: English" })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Expand voice agent" })).toBeVisible();
  await expect(modal.getByText("Your microphone is off")).toBeVisible();
  await expect(modal.getByRole("button", { name: "Show transcript" })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Book a meeting" })).toBeVisible();
  await expect(modal.locator("header").getByRole("button", { name: "Close voice agent" })).toBeVisible();
});
