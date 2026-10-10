import { expect, test } from "@playwright/test";

test("the book opens the complete Writing archive without featuring an essay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#writing");
  await expect(page.locator("[data-book-page]")).toContainText("The Cost ofKeeping Up");
  await page.locator("#writing [data-island-link]").click();
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  // The island's open notebook lifts off to face you and is thumbed through,
  // past printed essays, to the contents.
  const carry = page.locator("body > [data-book-transition]");
  await expect(carry).toHaveAttribute("data-book-transition", "entering");
  // Record that the very same notebook crosses the route boundary and opens
  // onto the page upright, centred and with every leaf turned over the spine.
  await carry.evaluate(node => {
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.bookTransition !== "revealing") return;
      const leaves = Array.from(node.querySelectorAll("[data-notebook-leaf]"));
      const book = node.querySelector('[data-notebook-page="right"]')!.parentElement!.getBoundingClientRect();
      const w = window as Window & { bookArrival?: { matched: boolean; turned: boolean; centred: boolean } };
      w.bookArrival = {
        matched: node.isConnected && location.pathname === "/writing",
        turned: leaves.length === (innerWidth < 760 ? 4 : 5) && leaves.every(leaf => new DOMMatrixReadOnly(getComputedStyle(leaf).transform).m11 < -.99),
        centred: Math.abs(book.left + book.width / 2 - innerWidth / 2) < 2 && book.width > innerWidth * .6,
      };
      observer.disconnect();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-book-transition"] });
  });
  await expect(carry.locator("[data-notebook-page]")).toHaveCount(2);
  await expect(carry.locator("svg")).toHaveCount(0);
  // The leaves carry the newest essays, as printed pages, with no ribbon.
  await expect(carry.locator('[data-notebook-leaf="0"]').first()).toContainText("The Cost of Keeping Up");
  await expect(carry.locator('[data-notebook-leaf="0"]').first()).toContainText("May 5, 2026".toUpperCase());
  // Every essay title is written in, all at the same size.
  const written = carry.locator("[data-notebook-page] li");
  await expect(written).toHaveCount(11);
  // The left page opens the archive with the newest essay.
  await expect(carry.locator('[data-notebook-page="left"] li').first()).toHaveText("The Cost of Keeping Up");
  expect(new Set(await written.evaluateAll(nodes => nodes.map(node => getComputedStyle(node.firstElementChild!).fontSize))).size).toBe(1);
  await expect(page).toHaveURL(/\/writing$/);
  await expect.poll(() => page.evaluate(() => (window as Window & { bookArrival?: object }).bookArrival)).toEqual({ matched: true, turned: true, centred: true });
  await expect(carry).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Writing", exact: true })).toBeFocused();
  await expect(page.getByRole("region", { name: "Featured essay" })).toHaveCount(0);
  await expect(page.locator("[data-essay-page]")).toHaveCount(0);
  await expect(page.locator(".archive-row")).toHaveCount(11);
  const titleStyles = await page.locator(".archive-row strong").evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node);
    return [style.fontSize, style.fontWeight, style.color].join("|");
  }));
  expect(new Set(titleStyles).size).toBe(1);
  await expect(page.locator('img[src^="/blender/island-writing-"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goBack();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  expect(errors).toEqual([]);
});

test("direct and reduced-motion Writing entry show every essay as a regular archive row", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#writing");
  await page.locator("#writing [data-island-link]").click();
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.locator("body > [data-book-transition]")).toHaveCount(0);
  await expect(page.locator("[data-essay-page]")).toHaveCount(0);
  await expect(page.locator(".archive-row").first()).toHaveAttribute("href", "https://carterko.substack.com/p/the-cost-of-keeping-up");
  const count = await page.locator('main a[href*="substack.com/p/"]').count();
  expect(count).toBeGreaterThan(10);
  await page.reload();
  await expect(page.locator(".archive-row")).toHaveCount(count);
  await expect(page.locator('main a[href*="substack.com/p/"]')).toHaveCount(count);
  await expect(page.locator("html")).not.toHaveAttribute("data-book-transition");
});

test("idle video stays alive and interaction increases its pace", async ({ page }) => {
  // Projects, not Writing: the sky holds its frame while Writing's loop plays.
  await page.goto("/#projects");
  const video = page.locator("[data-background-video]");
  const book = page.locator("#projects [data-island-link]");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.playbackRate)).toBe(0.55);
  const before = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(before + 0.1);
  await book.focus();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.playbackRate)).toBe(1);
  await page.getByRole("button", { name: "Show Projects island" }).focus();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.playbackRate)).toBe(0.55);
  expect(await video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
});
