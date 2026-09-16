import { expect, test } from "@playwright/test";

test("background video advances without scrolling, pauses across islands, and loops", async ({ page }) => {
  await page.goto("/2.0");
  const video = page.locator("[data-background-video]");
  const visual = page.locator("[data-background-visual]");
  await expect(visual).toHaveAttribute("data-video-ready", "true");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.1);
  expect(await video.evaluate((node: HTMLVideoElement) => node.muted && node.autoplay && node.loop && node.playsInline)).toBe(true);
  expect(await video.evaluate((node: HTMLVideoElement) => node.duration)).toBeCloseTo(12, 1);
  const viewport = page.viewportSize()!;
  expect(await video.evaluate((node: HTMLVideoElement) => node.currentSrc)).toContain(`starfield-loop-${viewport.width <= viewport.height ? "mobile" : "desktop"}-v1.mp4`);

  // Decode two actual video frames: advancing time alone could conceal a still clip.
  const frame = () => video.evaluate((node: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 180;
    canvas.getContext("2d")!.drawImage(node, 0, 0, 320, 180);
    return canvas.toDataURL();
  });
  const initialFrame = await frame();
  await expect.poll(frame).not.toBe(initialFrame);
  expect(await page.evaluate(() => scrollY)).toBe(0);

  await page.getByRole("button", { name: "Pause background video" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  const pausedTime = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
  await page.getByRole("button", { name: "Show Writing island" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  expect(await video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBe(pausedTime);
  await video.evaluate((node: HTMLVideoElement) => { node.currentTime = 11.75; });
  await page.getByRole("button", { name: "Play background video" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeLessThan(2);
  await expect(visual).toHaveAttribute("data-video-ready", "true");
  await expect(page.getByRole("button", { name: "Pause background video" })).toBeVisible();
  await page.getByRole("link", { name: "Enter Writing island" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await expect(page).toHaveURL(/\/writing$/, { timeout: 15_000 });
});

test("reduced motion uses a poster and supports an explicit choice to play", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => { if (/starfield-loop-.*\.mp4/.test(request.url())) requested.push(request.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0");
  const visual = page.locator("[data-background-visual]");
  const video = page.locator("[data-background-video]");
  await expect(visual).toHaveAttribute("data-video-ready", "false");
  await expect.poll(() => visual.locator("img").evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("button", { name: "Play background video" })).toBeVisible();
  expect(requested).toEqual([]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(visual).toHaveAttribute("data-video-ready", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(visual).toHaveAttribute("data-video-ready", "false");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await page.getByRole("button", { name: "Play background video" }).click();
  await expect(visual).toHaveAttribute("data-video-ready", "true");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
});

test("background video switches orientation and continues playing", async ({ page }) => {
  await page.goto("/2.0");
  const video = page.locator("[data-background-video]");
  for (const [width, height, variant] of [[390, 844, "mobile"], [844, 390, "desktop"]] as const) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentSrc)).toContain(`starfield-loop-${variant}-v1.mp4`);
    await expect(page.locator("[data-background-visual]")).toHaveAttribute("data-video-ready", "true");
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.1);
    const bounds = await video.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(width);
    expect(bounds!.height).toBeGreaterThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("failed background video retains its poster and working island entry", async ({ page }) => {
  await page.route("**/starfield-loop-*-v1.mp4", (route) => route.abort());
  await page.goto("/2.0");
  const visual = page.locator("[data-background-visual]");
  await expect(visual).toHaveAttribute("data-video-ready", "false");
  await expect.poll(() => visual.locator("img").evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(visual.locator("picture")).toHaveCSS("opacity", "1");
  await expect(page.getByRole("heading", { name: "Carter Wang" })).toBeVisible();
  await page.getByRole("link", { name: "Enter Work island" }).click();
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  await expect(page).toHaveURL(/\/work$/, { timeout: 15_000 });
});
