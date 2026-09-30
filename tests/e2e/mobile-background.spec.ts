import { expect, test } from "@playwright/test";

test("Work video stays fixed while scrolling and keeps playing", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile atmosphere behavior.");
  await page.goto("/work");
  const video = page.locator("[data-background-video]");
  // The fixed layer holds still; the stars inside it drift slowly on purpose.
  const layer = page.locator("[data-galaxy-background]");
  await expect(page.locator("[data-background-visual]")).toHaveAttribute("data-video-ready", "true");
  const initialBounds = await layer.boundingBox();
  const initialTime = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  expect(await layer.boundingBox()).toEqual(initialBounds);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(initialTime);
  expect(await video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
  await expect(page.getByRole("button", { name: /background video/ })).toHaveCount(0);
});
