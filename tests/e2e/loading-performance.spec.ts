import { expect, test } from "@playwright/test";

test("opening islands stay light while idle and only activate the visited GPU scene", async ({ page, isMobile }) => {
  const resources: string[] = [];
  page.on("request", request => resources.push(request.url()));
  await page.goto("/");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "intro");
  // Include the automatic phone peek; it must not download the full worlds.
  await page.waitForTimeout(7500);
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-warm", "false");
  expect(resources.filter(url => /\/(?:depth-|light-|island-.*\.glb)/.test(url))).toEqual([]);
  expect(resources.filter(url => /\/office\/scene-/.test(url))).toEqual([]);
  await page.locator("[data-next-scene]").click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  if (!isMobile) await expect(page.locator("#work [data-island-visual]")).toHaveAttribute("data-parallax", "on", { timeout: 15_000 });
  await expect(page.locator('#writing [data-parallax="on"], #projects [data-parallax="on"]')).toHaveCount(0);
});

test("destination pages prefetch the islands only on navigation intent", async ({ page, isMobile }) => {
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto("/writing");
  await expect(page.getByRole("heading", { name: "Writing", exact: true })).toBeVisible();
  await page.waitForTimeout(1800);
  const homeBundle = () => requests.some(url => /\/chunks\/app\/page-[^/]+\.js/.test(url));
  expect(homeBundle()).toBe(false);
  const back = page.getByRole("link", { name: "Back to islands" });
  if (isMobile) await back.focus(); else await back.hover();
  await expect.poll(homeBundle).toBe(true);
  await back.click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing", { timeout: 15_000 });
});

test("late fonts do not move the phone intro and islands", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Font wrapping at phone widths.");
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const probe = window as Window & { layoutShift?: number };
    probe.layoutShift = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) probe.layoutShift! += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.route("**/*.woff2", async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.fulfill({ response });
  });
  for (const width of [320, 360, 375, 390, 414, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
    const shift = await page.evaluate(() => (window as Window & { layoutShift?: number }).layoutShift);
    expect(shift, `${width}px delayed font CLS`).toBeLessThan(.05);
  }
});
