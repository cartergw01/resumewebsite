import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ viewport: { width: 1024, height: 1366 }, hasTouch: true, isMobile: true });

async function tap(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  const box = (await target.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

// Chromium normally drops :focus-visible on touch. Force that browser state to
// exercise the CSS cascade Safari can retain after scripted dialog/nav focus.
async function retainedFocus(page: Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const { root } = await session.send("DOM.getDocument");
  const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  await session.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["focus", "focus-visible"] });
  try { await expect(page.locator(selector)).toHaveCSS("outline-style", "none"); }
  finally { await session.detach(); }
}

test("the first touch is tracked before the island widgets load", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-warm", "false");
  const next = page.locator("[data-next-scene]");
  await expect(next).toBeEnabled();
  await tap(page, next);
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await expect(page.locator("html")).toHaveAttribute("data-pointer-input", "");
});

test("tablet navigation keeps touch outlines hidden across routes and restores keyboard focus", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Forces Safari's retained-focus state through CDP.");
  await page.goto("/#writing");
  await expect(page.locator("[data-thought-cards]")).toBeVisible();
  await page.getByRole("link", { name: "Writing", exact: true }).tap();
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.locator("html")).toHaveAttribute("data-pointer-input", "");
  const selector = '.site-nav-primary a[aria-current="page"]';
  await retainedFocus(page, selector);
  await page.keyboard.press("Tab");
  await page.locator(selector).focus();
  await expect(page.locator(selector)).toHaveCSS("outline-style", "solid");
  await tap(page, page.locator(selector));
  await retainedFocus(page, selector);

  // A direct entry has no island widgets, in either iPad orientation.
  await page.setViewportSize({ width: 1366, height: 1024 });
  await page.goto("/writing");
  await page.locator(selector).tap();
  await retainedFocus(page, selector);
  await page.screenshot({ path: "/tmp/carter-ipad-writing-focus.png" });
});

test("project dialogs and island menu do not leave touch focus boxes", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Forces Safari's retained-focus state through CDP.");
  await page.goto("/#projects");
  const poker = page.getByRole("button", { name: "Poker Odds", exact: true });
  await expect(poker).toBeVisible();
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-travelling", "true");
  const pin = await poker.evaluate(node => {
    const point = node.querySelector("span")!.getBoundingClientRect();
    return { x: point.x, y: point.y };
  });
  await page.touchscreen.tap(pin.x, pin.y);
  await expect(page.getByRole("dialog")).toBeVisible();
  const close = 'button[aria-label="Close poker challenge"]';
  await retainedFocus(page, close);
  await page.keyboard.press("Tab");
  await page.locator(close).focus();
  await expect(page.locator(close)).toHaveCSS("outline-style", "solid");
  await page.locator(close).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(poker).toBeFocused();
  await expect(poker).toHaveCSS("outline-style", "none");
  const writing = '[data-scene-nav] button[aria-label="Show Writing island"]';
  await tap(page, page.locator(writing));
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await retainedFocus(page, writing);
  await page.screenshot({ path: "/tmp/carter-ipad-island-focus.png" });
});

test("office utilities clear retained touch outlines and keep keyboard indicators", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Forces Safari's retained-focus state through CDP.");
  await page.goto("/work");
  await page.evaluate(() => {
    HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error("Fullscreen unavailable"));
  });
  await page.getByRole("button", { name: "Full screen", exact: true }).tap();
  await expect(page.locator("[data-office-explorer]")).toHaveAttribute("data-expanded", "true");
  await page.getByRole("button", { name: "Exit full screen", exact: true }).tap();
  await expect(page.locator("[data-office-explorer]")).toHaveAttribute("data-expanded", "false");
  await expect(page.getByRole("button", { name: "Full screen", exact: true })).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-pointer-input", "");
  await retainedFocus(page, 'button[aria-label="Full screen"]');

  await page.getByRole("button", { name: "Zoom in", exact: true }).tap();
  await retainedFocus(page, 'button[aria-label="See whole office"]');
  await page.keyboard.press("Tab");
  for (const name of ["Full screen", "See whole office"]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.focus();
    await expect(button).toHaveCSS("outline-style", "solid");
  }
});
