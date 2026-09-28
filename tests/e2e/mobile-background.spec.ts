import { expect, test } from "@playwright/test";

test("Work video stays fixed while scrolling and respects the pause control", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile atmosphere behavior.");
  await page.goto("/work");
  const video = page.locator("[data-background-video]");
  await expect(page.locator("[data-background-visual]")).toHaveAttribute("data-video-ready", "true");
  const initialBounds = await video.boundingBox();
  const initialTime = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  expect(await video.boundingBox()).toEqual(initialBounds);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(initialTime);
  await page.getByRole("button", { name: "Pause background video" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await page.getByRole("button", { name: "Play background video" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
});
