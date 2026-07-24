import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  // These tests intentionally drive multiple full-screen Retina canvases.
  // Serial execution measures one real site session and avoids turning the
  // shared local web server into an unrelated multi-tab GPU stress test.
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        deviceScaleFactor: 2,
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "mobile-webkit",
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
      },
    },
  ],
});
