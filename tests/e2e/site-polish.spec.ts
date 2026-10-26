import { expect, test } from "@playwright/test";

for (const width of [320, 390]) test(`navigation has distinct, comfortable tap targets at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  // /resume intentionally retains its production navigation and touch padding.
  for (const route of ["/", "/", "/work", "/writing", "/projects"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    // Wait for the navigation's font without blocking on unrelated off-screen fonts.
    await page.locator(".site-nav a").first().evaluate(async link => {
      const { fontWeight, fontSize, fontFamily } = getComputedStyle(link);
      await document.fonts.load(`${fontWeight} ${fontSize} ${fontFamily}`);
    });
    const result = await page.locator(".site-nav").evaluate((nav, minimum) => {
      const rects = [...nav.querySelectorAll("a")].map(a => ({ name: a.getAttribute("aria-label") || a.textContent, rect: a.getBoundingClientRect() })).filter(a => a.rect.width && a.rect.height);
      return {
        small: rects.filter(a => a.rect.height < 44 || a.rect.width < minimum).map(a => a.name),
        outside: rects.filter(a => a.rect.left < 0 || a.rect.right > innerWidth).map(a => a.name),
        overlaps: rects.flatMap((a, i) => rects.slice(i + 1).filter(b => Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1).map(b => `${a.name}/${b.name}`)),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    }, route === "/" ? 24 : 44);
    expect(result, `${route} at ${width}px`).toEqual({ small: [], outside: [], overlaps: [], overflow: false });
  }
});

test("subscription validates email and offers an editable fallback when the popup is blocked", async ({ page }) => {
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
  const retry = page.getByRole("link", { name: "Continue on Substack", exact: true });
  await expect(retry).toHaveAttribute("href", "https://carterko.substack.com/subscribe?email=reader%40example.com");
  await expect(email).toHaveValue("reader@example.com");
  await email.fill("reader+updated@example.com");
  await expect(retry).toHaveCount(0);
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  const correctedUrl = "https://carterko.substack.com/subscribe?email=reader%2Bupdated%40example.com";
  await expect(retry).toHaveAttribute("href", correctedUrl);
  // Intercept the external handoff: never send a test subscription to Substack.
  await page.route("https://carterko.substack.com/subscribe**", route => route.fulfill({ contentType: "text/html", body: "<h1>Subscription handoff</h1>" }));
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(correctedUrl);
  await expect(page.getByRole("heading", { name: "Subscription handoff" })).toBeVisible();
});

test("subscription can be retried after its new tab is closed", async ({ page, context }) => {
  await context.route("https://carterko.substack.com/subscribe**", route => route.fulfill({ contentType: "text/html", body: "<h1>Subscription handoff</h1>" }));
  await page.goto("/writing");
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.fill("reader@example.com");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  const popup = await popupPromise;
  const url = "https://carterko.substack.com/subscribe?email=reader%40example.com";
  await expect(popup).toHaveURL(url);
  await popup.close();
  await expect(email).toBeEditable();
  await expect(email).toHaveValue("reader@example.com");
  await page.getByRole("link", { name: "Continue on Substack", exact: true }).click();
  await expect(page).toHaveURL(url);
});

test("data saver keeps the workshop usable without preloading models or the whole gallery", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: Object.assign(new EventTarget(), { saveData: true }) }));
  const downloads: string[] = [];
  page.on("request", request => downloads.push(request.url()));
  await page.goto("/#projects");
  await expect(page.locator("#projects [data-island-visual] > img")).toBeVisible();
  await page.waitForTimeout(1200);
  expect(downloads.filter(url => url.endsWith(".glb"))).toEqual([]);
  const posters = await page.locator("#projects [data-workshop-screen]").getAttribute("data-posters");
  const otherImages: string[] = JSON.parse(posters!).slice(1);
  expect(downloads.filter(url => otherImages.some(src => url.includes(src)))).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#projects [data-island-link]").click();
  await expect(page).toHaveURL(/\/projects$/);
});
