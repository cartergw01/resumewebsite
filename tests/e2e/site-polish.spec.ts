import { expect, test } from "@playwright/test";

for (const width of [320, 390]) test(`navigation has distinct, comfortable tap targets at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  for (const route of ["/", "/2.0", "/work", "/writing", "/projects", "/resume"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    // Wait for the navigation's font; unrelated off-screen font/layout work
    // on the long resume page must not hold up this target-size measurement.
    await page.locator(".site-nav a").first().evaluate(async link => {
      const { fontWeight, fontSize, fontFamily } = getComputedStyle(link);
      await document.fonts.load(`${fontWeight} ${fontSize} ${fontFamily}`);
    });
    const result = await page.locator(".site-nav").evaluate(nav => {
      const rects = [...nav.querySelectorAll("a")].map(a => ({ name: a.getAttribute("aria-label") || a.textContent, rect: a.getBoundingClientRect() })).filter(a => a.rect.width && a.rect.height);
      return {
        small: rects.filter(a => a.rect.height < 44 || a.rect.width < 24).map(a => a.name),
        outside: rects.filter(a => a.rect.left < 0 || a.rect.right > innerWidth).map(a => a.name),
        overlaps: rects.flatMap((a, i) => rects.slice(i + 1).filter(b => Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1).map(b => `${a.name}/${b.name}`)),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(result, `${route} at ${width}px`).toEqual({ small: [], outside: [], overlaps: [], overflow: false });
  }
});

test("email validation prevents an invalid subscription handoff", async ({ page }) => {
  await page.goto("/writing");
  await page.evaluate(() => {
    const w = window as Window & { opened?: string[] };
    w.opened = [];
    window.open = (url) => { w.opened!.push(String(url)); return null; };
  });
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { opened?: string[] }).opened)).toEqual([]);
  await expect(email).toBeFocused();
  await email.fill("reader@example.com");
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { opened?: string[] }).opened)).toEqual(["https://carterko.substack.com/subscribe?email=reader%40example.com"]);
  await expect(page.getByRole("status")).toHaveText("Continue on Substack to finish subscribing.");
});

test("data saver keeps the workshop usable without preloading models or the whole gallery", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: Object.assign(new EventTarget(), { saveData: true }) }));
  const downloads: string[] = [];
  page.on("request", request => downloads.push(request.url()));
  await page.goto("/2.0#projects");
  await expect(page.locator("#projects [data-island-visual] > img")).toBeVisible();
  await page.waitForTimeout(1200);
  expect(downloads.filter(url => url.endsWith(".glb"))).toEqual([]);
  const posters = await page.locator("[data-workshop-screen]").getAttribute("data-posters");
  const otherImages: string[] = JSON.parse(posters!).slice(1);
  expect(downloads.filter(url => otherImages.some(src => url.includes(src)))).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#projects [data-island-link]").click();
  await expect(page).toHaveURL(/\/projects$/);
});
