import { expect, test } from "@playwright/test";

test("writing video loads on arrival, loops, pauses, and stops offscreen", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => { if (request.url().includes("writing-island-loop")) requested.push(request.url()); });
  await page.goto("/2.0");
  await expect(page.getByRole("button", { name: /island animation/ })).toHaveCount(0);
  const video = page.locator("#writing video");
  const visual = page.locator("#writing [data-island-visual]");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  expect(requested).toEqual([]);
  await page.getByRole("button", { name: "Show Writing island" }).click();
  await expect(visual).toHaveAttribute("data-video-ready", "true");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.1);
  expect(await video.evaluate((node: HTMLVideoElement) => node.muted && node.loop && node.playsInline)).toBe(true);
  expect(await video.evaluate((node: HTMLVideoElement) => node.duration)).toBeCloseTo(8, 1);

  await page.getByRole("button", { name: "Pause background video" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await expect(page).toHaveURL(/\/2\.0(?:#writing)?$/);
  await video.evaluate((node: HTMLVideoElement) => { node.currentTime = 7.75; });
  await page.getByRole("button", { name: "Play background video" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeLessThan(2);
  await page.getByRole("button", { name: "Show Projects island" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await page.getByRole("button", { name: "Show Writing island" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
});

test("reduced motion keeps the original artwork and responds to preference changes", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => { if (request.url().includes("writing-island-loop")) requested.push(request.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0#writing");
  const visual = page.locator("#writing [data-island-visual]");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await expect(visual).toHaveAttribute("data-video-ready", "false");
  await expect(visual.locator("img")).toHaveCSS("opacity", "1");
  expect(requested).toEqual([]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(visual).toHaveAttribute("data-video-ready", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(visual).toHaveAttribute("data-video-ready", "false");
  await expect.poll(() => visual.locator("video").evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await expect(page.getByRole("button", { name: "Pause writing island animation" })).toHaveCount(0);
});

test("a video download failure leaves the artwork and island entry usable", async ({ page }) => {
  await page.route("**/writing-island-loop-v1.*", (route) => route.abort());
  await page.goto("/2.0#writing");
  const visual = page.locator("#writing [data-island-visual]");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await expect(visual).toHaveAttribute("data-video-ready", "false");
  await expect(visual.locator("img")).toBeVisible();
  await page.getByRole("link", { name: "Enter Writing island" }).click();
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  await expect(page).toHaveURL(/\/writing$/, { timeout: 15_000 });
});
