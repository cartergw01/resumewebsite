import { expect, test } from "@playwright/test";

test("the printed essay page travels out of the book and docks in Writing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/2.0#writing");
  const source = page.locator("[data-book-page]");
  await expect(source).toContainText("The Cost ofKeeping Up");
  const print = await source.innerHTML();
  await page.locator("#writing [data-island-link]").click();
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  const carry = page.locator("body > [data-book-transition]");
  await expect(carry).toHaveAttribute("data-book-transition", "entering");
  expect(await carry.locator("svg").innerHTML()).toBe(print);
  await carry.evaluate(node => node.setAttribute("data-same-page", "true"));
  await expect(page).toHaveURL(/\/writing$/);
  await expect(carry).toHaveAttribute("data-book-transition", "arriving");
  await expect(carry).toHaveAttribute("data-same-page", "true");
  expect(await page.locator("[data-essay-page] svg").innerHTML()).toBe(print);
  await expect(carry).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Read The Cost of Keeping Up on Substack" })).toBeFocused();
  await expect(page.locator("[data-essay-page]")).toBeVisible();
  await expect(page.locator('img[src="/world-writing-cutout-v1.webp"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Back to islands" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  expect(errors).toEqual([]);
});

test("direct and reduced-motion Writing entry keep the essay and archive usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0#writing");
  await page.locator("#writing [data-island-link]").click();
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.locator("body > [data-book-transition]")).toHaveCount(0);
  await expect(page.locator("[data-essay-page]")).toBeVisible();
  await expect(page.getByRole("link", { name: "Read The Cost of Keeping Up on Substack" })).toHaveAttribute("href", "https://carterko.substack.com/p/the-cost-of-keeping-up");
  const count = await page.locator('main a[href*="substack.com/p/"]').count();
  expect(count).toBeGreaterThan(10);
  await page.reload();
  await expect(page.locator("[data-essay-page]")).toBeVisible();
  await expect(page.locator('main a[href*="substack.com/p/"]')).toHaveCount(count);
  await expect(page.locator("html")).not.toHaveAttribute("data-book-transition");
});

test("idle video stays alive, interaction increases its pace, and Pause remains authoritative", async ({ page }) => {
  await page.goto("/2.0#writing");
  const video = page.locator("[data-background-video]");
  const book = page.locator("#writing [data-island-link]");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.playbackRate)).toBe(0.55);
  const before = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(before + 0.1);
  await book.focus();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.playbackRate)).toBe(1);
  await page.getByRole("button", { name: "Show Writing island" }).focus();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.playbackRate)).toBe(0.55);
  await page.getByRole("button", { name: "Pause background video" }).click();
  await book.focus();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await expect.poll(() => page.locator("#writing video").evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
});
