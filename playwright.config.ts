import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results/playwright",
  use: {
    baseURL: "http://127.0.0.1:3200",
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command:
        "export NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_URL=http://127.0.0.1:4200 NEXT_PUBLIC_DOGOS_ENV=local WEB_ORIGIN=http://127.0.0.1:3200; node apps/web/node_modules/next/dist/bin/next build apps/web --webpack && node apps/web/node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port 3200",
      url: "http://127.0.0.1:3200",
      reuseExistingServer: false,
      timeout: 300_000,
    },
    {
      command:
        "NODE_OPTIONS=--conditions=development API_PORT=4200 DOGOS_AUTH_MODE=local DOGOS_ENV=test WEB_ORIGIN=http://127.0.0.1:3200 node node_modules/tsx/dist/cli.mjs apps/api/src/server.ts",
      url: "http://127.0.0.1:4200/health/ready",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
