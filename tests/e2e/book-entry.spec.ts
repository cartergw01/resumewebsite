import { expect, test } from "@playwright/test";

test("the book opens the complete Writing archive without featuring an essay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/2.0#writing");
  await expect(page.locator("[data-book-page]")).toContainText("The Cost ofKeeping Up");
  await page.locator("#writing [data-island-link]").click();
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  // The island's open notebook lifts off as a blank ruled spread and fills the view.
  const carry = page.locator("body > [data-book-transition]");
  await expect(carry).toHaveAttribute("data-book-transition", "entering");
  // The faster handoff no longer holds on "arriving" for a polling interval.
  // Record that the very same notebook crosses the route boundary.
  await carry.evaluate(node => {
    const recordFrame = () => {
      if (!node.isConnected) return;
      const box = node.querySelector('[data-notebook-page="right"]')!.getBoundingClientRect();
      if (Math.round(box.right) >= innerWidth - 1 && Math.round(box.bottom) >= innerHeight - 1) {
        (window as Window & { bookFilledViewport?: boolean }).bookFilledViewport = true;
      }
      requestAnimationFrame(recordFrame);
    };
    requestAnimationFrame(recordFrame);
    const observer = new MutationObserver(() => {
      if ((node as HTMLElement).dataset.bookTransition === "arriving") {
        (window as Window & { bookArrivalMatched?: boolean }).bookArrivalMatched = node.isConnected && location.pathname === "/writing";
        observer.disconnect();
      }
    });
    observer.observe(node, { attributes: true, attributeFilter: ["data-book-transition"] });
  });
  await expect(carry.locator("[data-notebook-page]")).toHaveCount(2);
  await expect(carry.locator("svg")).toHaveCount(0);
  // Every essay title is written in, all at the same size.
  const written = carry.locator("[data-notebook-page] li");
  await expect(written).toHaveCount(11);
  await expect(written.first()).toHaveText("The Cost of Keeping Up");
  expect(new Set(await written.evaluateAll(nodes => nodes.map(node => getComputedStyle(node.firstElementChild!).fontSize))).size).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as Window & { bookFilledViewport?: boolean }).bookFilledViewport)).toBe(true);
  await expect(page).toHaveURL(/\/writing$/);
  await expect.poll(() => page.evaluate(() => (window as Window & { bookArrivalMatched?: boolean }).bookArrivalMatched)).toBe(true);
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
  await page.goto("/2.0#writing");
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
  expect(await video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
});
