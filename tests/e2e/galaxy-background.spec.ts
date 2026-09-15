import { expect, test } from "@playwright/test";

test("galaxy selects the viewport artwork and drifts independently of scroll", async ({ page }, testInfo) => {
  await page.goto("/2.0");
  const image = page.locator("[data-galaxy-image] img");
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  expect(await image.evaluate((node: HTMLImageElement) => node.currentSrc)).toContain(testInfo.project.name === "desktop" ? "galaxy-alive-desktop" : "galaxy-alive-mobile");
  const picture = page.locator("[data-galaxy-image]");
  const initialTransform = await picture.evaluate((node) => getComputedStyle(node).transform);
  await expect.poll(() => picture.evaluate((node) => getComputedStyle(node).transform)).not.toBe(initialTransform);
  expect(await page.evaluate(() => scrollY)).toBe(0);

  await page.getByRole("button", { name: "Pause galaxy animation" }).click();
  await expect(page.locator("[data-galaxy-background]")).toHaveAttribute("data-ambient-paused", "true");
  await expect.poll(() => picture.evaluate((node) => node.getAnimations().every((animation) => animation.playState === "paused"))).toBe(true);
  for (const star of await page.locator("[data-ambient-star]").all()) await expect(star).toHaveCSS("animation-play-state", "paused");
  await page.getByRole("button", { name: "Show Writing island" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await expect(page.locator("[data-galaxy-background]")).toHaveAttribute("data-ambient-paused", "true");
  await page.getByRole("button", { name: "Play galaxy animation" }).click();
  await expect(picture).toHaveCSS("animation-play-state", "running");
  await expect(page.locator("[data-island-stage]")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("reduced motion keeps the galaxy and foreground stars still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0");
  await expect(page.locator("[data-galaxy-image]")).toHaveCSS("animation-name", "none");
  await expect(page.locator("[data-ambient-star]").first()).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("button", { name: "Pause galaxy animation" })).toBeHidden();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.getByRole("button", { name: "Pause galaxy animation" })).toBeVisible();
  await expect(page.locator("[data-galaxy-image]")).not.toHaveCSS("animation-name", "none");
});
