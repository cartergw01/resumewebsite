import { expect, test, type Locator, type Page } from "@playwright/test";

async function openShelf(page: Page) {
  await page.goto("/new");
  await page.evaluate(() => document.fonts.ready);
  const shelf = page.getByRole("region", { name: "Essay bookshelf" });
  await shelf.scrollIntoViewIfNeeded();
  await expect(shelf.locator("[data-essay-motion]")).toHaveCount(11);
  return shelf;
}

async function angles(shelf: Locator) {
  return shelf.locator("[data-essay-motion]").evaluateAll((covers) => covers.map((cover) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(cover).transform);
    return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
  }));
}

async function isAtRest(shelf: Locator) {
  return shelf.locator("[data-essay-motion]").evaluateAll((covers) => covers.every((cover) => {
    const style = (cover as HTMLElement).style;
    return !style.transform && !style.willChange;
  }));
}

test("essay art follows sideways scroll and settles without moving the text", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const shelf = await openShelf(page);
  const title = shelf.locator("h3").nth(1);
  const top = await title.evaluate((element) => element.getBoundingClientRect().top);
  const width = await shelf.evaluate((element) => element.scrollWidth);

  await shelf.evaluate((element) => element.scrollBy({ left: 450, behavior: "smooth" }));
  await expect.poll(async () => Math.min(...await angles(shelf))).toBeLessThan(-0.3);
  expect(await title.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(top, 0);
  await expect.poll(() => isAtRest(shelf)).toBe(true);

  await shelf.evaluate((element) => element.scrollBy({ left: -260, behavior: "smooth" }));
  await expect.poll(async () => Math.max(...await angles(shelf))).toBeGreaterThan(0.3);
  await expect.poll(() => isAtRest(shelf)).toBe(true);

  // Catch an idle loop that keeps touching DOM styles after the spring settles.
  const idleMutations = await shelf.evaluate((element) => new Promise<number>((resolve) => {
    let count = 0;
    const observer = new MutationObserver((records) => { count += records.length; });
    for (const cover of element.querySelectorAll("[data-essay-motion]")) {
      observer.observe(cover, { attributes: true, attributeFilter: ["style"] });
    }
    setTimeout(() => { observer.disconnect(); resolve(count); }, 250);
  }));
  expect(idleMutations).toBe(0);
  expect(await shelf.evaluate((element) => element.scrollWidth)).toBe(width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("shelf motion respects preference changes, offscreen state, and keyboard browsing", async ({ page, browserName }) => {
  const shelf = await openShelf(page);
  await shelf.evaluate((element) => element.scrollBy({ left: 400, behavior: "smooth" }));
  await expect.poll(async () => Math.min(...await angles(shelf))).toBeLessThan(-0.3);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => isAtRest(shelf)).toBe(true);

  const essays = shelf.getByRole("link");
  await essays.first().focus();
  // WebKit on macOS uses Option-Tab to include links in keyboard navigation.
  const nextLink = browserName === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab";
  for (let index = 1; index < 11; index++) await page.keyboard.press(nextLink);
  await expect(essays.last()).toBeFocused();
  expect(await shelf.evaluate((element) => element.scrollLeft)).toBeGreaterThan(1000);
  expect(await isAtRest(shelf)).toBe(true);
  await expect(essays.last().locator("[data-essay-motion]")).toHaveCSS("transform", "none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await shelf.evaluate((element) => element.scrollBy({ left: -500, behavior: "smooth" }));
  await expect.poll(async () => Math.max(...await angles(shelf))).toBeGreaterThan(0.3);
  await page.locator("#home-title").scrollIntoViewIfNeeded();
  await expect.poll(() => isAtRest(shelf)).toBe(true);
});
