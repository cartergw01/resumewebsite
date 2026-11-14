import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const shop = JSON.parse(readFileSync(new URL("../../lib/bookshop.json", import.meta.url), "utf8")) as typeof import("../../lib/bookshop.json");
const openings = JSON.parse(readFileSync(new URL("../../content/essay-openings.json", import.meta.url), "utf8")) as Record<string, string>;
const oldest = [...shop.essays].sort((a, b) => a.rect[0] - b.rect[0])[0];
const newest = [...shop.essays].sort((a, b) => b.rect[0] - a.rect[0])[0];

// Scrolls until the shop is pinned and the given fraction of the walk is done.
async function walk(page: Page, fraction: number) {
  // The walk's length is known once the shop has measured itself.
  await expect.poll(() => page.evaluate(() => parseFloat(document.querySelector<HTMLElement>("section[aria-label='The bookshop']")?.style.getPropertyValue("--walk") || "0"))).toBeGreaterThan(0);
  await page.evaluate(async share => {
    const section = document.querySelector<HTMLElement>("section[aria-label='The bookshop']")!;
    const walk = parseFloat(section.style.getPropertyValue("--walk"));
    const sticky = section.firstElementChild as HTMLElement;
    const top = parseFloat(getComputedStyle(sticky).top);
    window.scrollTo(0, window.scrollY + section.getBoundingClientRect().top - top + walk * share);
    // The shop repaints on the scroll event, a frame or two after it.
    await new Promise(resolve => setTimeout(resolve, 150));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, fraction);
}

test("scrolling walks you along the shop, past the essays in order", async ({ page }) => {
  await page.goto("/writing");
  const shopSection = page.locator("section[aria-label='The bookshop']");
  await expect(shopSection).toBeVisible();
  await expect(shopSection.locator("[data-shop-item]").first()).toBeAttached();
  const caption = shopSection.locator("[aria-live]");

  await walk(page, 0);
  const startX = (await shopSection.locator(`[data-shop-item="${newest.slug}"]`).boundingBox())!.x;
  await walk(page, 1);
  const endX = (await shopSection.locator(`[data-shop-item="${newest.slug}"]`).boundingBox())!.x;
  expect(endX).toBeLessThan(startX - 200);
  // The shop stays pinned while you walk it.
  const pinned = await shopSection.locator("div").first().boundingBox();
  expect(pinned!.y).toBeGreaterThanOrEqual(0);
  expect(pinned!.y).toBeLessThan(140);

  // Tabbing to the first essay walks you to it and names it underneath.
  await walk(page, 0);
  await page.evaluate(() => { delete document.documentElement.dataset.pointerInput; });
  await shopSection.locator(`[data-shop-item="${oldest.slug}"] button`).focus();
  await expect(caption).toContainText(oldest.title, { timeout: 5_000 });
});

test("taking a book down opens it on its date, title and a link to read it", async ({ page }) => {
  await page.goto("/writing");
  const book = page.locator(`section[aria-label='The bookshop'] [data-shop-item="${newest.slug}"] button`);
  await walk(page, 1);
  await book.click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog.getByRole("heading")).toHaveText(newest.title);
  await expect(dialog.getByRole("link", { name: /reading on Substack/i })).toHaveAttribute("href", `https://carterko.substack.com/p/${newest.slug}`);
  // The page opens on how the essay begins, in its own words.
  await expect(dialog).toContainText(openings[newest.slug].split("\n")[0].slice(0, 40));
  // The arrows turn to the book before it on the shelf without closing.
  await dialog.getByRole("button", { name: "Previous book" }).click();
  await expect(dialog.getByRole("heading")).not.toHaveText(newest.title);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("the letter slot holds the subscribe form, and the corkboard opens the tweets", async ({ page }) => {
  await page.goto("/writing");
  await walk(page, 0);
  await page.locator("section[aria-label='The bookshop'] [data-shop-item='letters'] button").click();
  await expect(page.locator("dialog[open] #bookshop-email")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await walk(page, 1);
  await page.locator("section[aria-label='The bookshop'] [data-shop-item='notes'] button").click();
  await expect(page.locator("dialog[open]")).toBeVisible();
});

test("arrow keys step along the shelf", async ({ page, isMobile }) => {
  test.skip(isMobile, "Arrow keys are for keyboards");
  await page.goto("/writing");
  await walk(page, 0);
  const caption = page.locator("section[aria-label='The bookshop'] [aria-live]");
  const seen = new Set<string>();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(900);
    seen.add((await caption.textContent()) ?? "");
  }
  expect(seen.size).toBeGreaterThan(2);
  expect([...seen].some(text => text.includes(oldest.title))).toBe(true);
});
