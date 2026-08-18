import { defineConfig, devices } from "@playwright/test";

// E2E smoke suite for the golden path (see the Chatty Test Strategy
// artifact, Phase 3). Runs against the real production site by default —
// this project's Supabase project IS the only environment, staging and
// prod aren't separated — so tests must be read-only or self-cleaning
// against real data. Override BASE_URL to point at a preview deploy.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "https://chatty.personaliai.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
