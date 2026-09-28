import { expect, test } from "@playwright/test";

test("Work video lives inside the room window and respects the pause control", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile atmosphere behavior.");
  await page.goto("/work");
  const video = page.locator("[data-background-video]");
  await expect(page.locator("[data-background-visual]")).toHaveAttribute("data-video-ready", "true");
  const window = page.locator("[data-galaxy-background]");
  await expect(window).toHaveCSS("position", "absolute");
  const windowBounds = await window.boundingBox();
  const roomBounds = await page.getByRole("region", { name: "Carter's workroom" }).boundingBox();
  expect(windowBounds!.x).toBeGreaterThan(roomBounds!.x);
  expect(windowBounds!.y).toBeGreaterThanOrEqual(roomBounds!.y);
  expect(windowBounds!.x + windowBounds!.width).toBeLessThan(roomBounds!.x + roomBounds!.width);
  expect(windowBounds!.y + windowBounds!.height).toBeLessThan(roomBounds!.y + roomBounds!.height);
  const initialTime = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(initialTime);
  await page.getByRole("button", { name: "Pause background video" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await page.getByRole("button", { name: "Play background video" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
});
