import { defineConfig, devices } from "@playwright/test";

const fullBrowserMatrix = process.env.PW_FULL_BROWSER_MATRIX === "true";
const projects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
];
if (fullBrowserMatrix) {
  projects.push(
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  );
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  workers: fullBrowserMatrix ? 3 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  webServer: [
    {
      command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174",
      cwd: "./client",
      env: {
        ...process.env,
        VITE_API_URL: "http://127.0.0.1:5100/api",
        VITE_E2E: "true",
      },
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "node e2e/mock-api.cjs",
      cwd: ".",
      url: "http://127.0.0.1:5100/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
    locale: "vi-VN",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects,
});
