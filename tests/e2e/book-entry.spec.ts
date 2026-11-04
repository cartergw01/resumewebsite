import { expect, test } from "@playwright/test";
import { expectRocketLaunched, watchRocketLaunch } from "./rocket-launch";

test("the book opens the complete Writing archive", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#writing");
  const spread = page.locator("#writing [data-book-spread]");
  await expect(spread).toHaveAttribute("data-essays", /The Cost of Keeping Up/);
  // The paper and ink are rendered together. Neither dimming the room nor
  // hovering the book should bring back the old flat rectangular overlay.
  const lightsOff = page.getByRole("switch", { name: "study lights" });
  if (isMobile) await lightsOff.tap(); else await lightsOff.click();
  await expect(page.locator("html")).toHaveAttribute("data-writing-lights", "off");
  if (!isMobile) await page.locator("#writing [data-island-link]").hover();
  await expect(page.locator("#writing [data-book-page], #writing [data-book-response]")).toHaveCount(0);
  expect(await spread.evaluate(node => getComputedStyle(node).fill)).toBe("none");
  // The spread's touch glow exists for press feedback, but stays unseen at rest.
  await expect(page.locator("#writing svg:has([data-touch-surface='spread'])")).toHaveCSS("opacity", "0");
  const lightsOn = page.getByRole("switch", { name: "study lights" });
  if (isMobile) await lightsOn.tap(); else await lightsOn.click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await watchRocketLaunch(page);
  const island = page.locator("#writing [data-island-link]");
  if (isMobile) await island.tap(); else await island.click();
  await expectRocketLaunched(page);
  // The island's open notebook lifts off to face you and is thumbed through,
  // past Carter's printed essays.
  const carry = page.locator("body > [data-book-transition]");
  await expect(carry).toHaveAttribute("data-book-transition", "entering");
  // Record that the very same notebook crosses the route boundary and opens
  // onto the page upright, centred and with every leaf turned over the spine.
  const essays = JSON.parse(await page.locator("#writing [data-book-spread]").getAttribute("data-essays") ?? "[]").length;
  await carry.evaluate((node, essays) => {
    const expectedLeaves = Math.min(innerWidth < 760 ? 5 : 7, Math.floor((essays - 2) / 2));
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.bookTransition !== "revealing") return;
      const leaves = Array.from(node.querySelectorAll("[data-notebook-leaf]"));
      const book = node.querySelector('[data-notebook-page="right"]')!.parentElement!.getBoundingClientRect();
      const w = window as Window & { bookArrival?: { matched: boolean; turned: boolean; centred: boolean } };
      w.bookArrival = {
        matched: node.isConnected && location.pathname === "/writing",
        // One essay to a page: the spread holds two and every leaf two more,
        // with only as many leaves as fill both faces (no blank pages). A
        // leaf at rest is also shrunk to cancel the notebook's perspective
        // (flat), more so on a phone's closer camera, so its turn is read
        // from the direction of its x axis alone, not that scale.
        turned: leaves.length === expectedLeaves && leaves.every(leaf => {
          const m = new DOMMatrixReadOnly(getComputedStyle(leaf).transform);
          return m.m11 / Math.hypot(m.m11, m.m12, m.m13) < -.99;
        }),
        centred: Math.abs(book.left + book.width / 2 - innerWidth / 2) < 2 && book.width > innerWidth * .6,
      };
      observer.disconnect();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-book-transition"] });
  }, essays);
  await expect(carry.locator("[data-notebook-page]")).toHaveCount(2);
  await expect(carry.locator("svg")).toHaveCount(0);
  // It opens on the newest essay, one essay to a page; every page is one of
  // Carter's essays, with no reading-list roundups and no contents page.
  await expect(carry.locator('[data-notebook-page="left"]')).toContainText("The Cost of Keeping Up");
  await expect(carry.locator('[data-notebook-page="left"]')).toContainText("MAY 5, 2026");
  await expect(carry.locator('[data-notebook-leaf="0"]')).toContainText("Slop and Spiral");
  await expect(carry).not.toContainText("Best Things I Read");
  await expect(carry.locator("li")).toHaveCount(0);
  expect(await carry.evaluate(node => Array.from(node.querySelectorAll("[class*=leaf]")).every(page => page.textContent!.trim().length > 0))).toBe(true);
  // The route swaps in once the notebook lies open on its last spread.
  await expect(page).toHaveURL(/\/writing$/, { timeout: 10_000 });
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
  // Let hash restoration finish before Playwright scrolls the link into view.
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-travelling", "false");
  await expect(page.getByRole("button", { name: "Show Writing island" })).toBeEnabled();
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
