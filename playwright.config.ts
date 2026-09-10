import { defineConfig, devices } from "@playwright/test";

// E2E smoke suite for the golden path (see the Chatty Test Strategy
// artifact, Phase 3). Runs against the real production site by default -
// this project's Supabase project IS the only environment, staging and
// prod aren't separated - so tests must be read-only or self-cleaning
// against real data. Override BASE_URL to point at a preview deploy.
export default defineConfig({
  testDir: "./e2e",
  // CI runs deterministic browser checks only.  The production-connected
  // suite remains available locally/on demand as a separate smoke signal.
  testIgnore: process.env.E2E_MODE === "deterministic" ? /golden-path\.spec\.ts/ : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_MODE === "deterministic" ? {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      NEXT_PUBLIC_BACKEND_URL: "http://127.0.0.1:3000",
    },
  } : undefined,
});
