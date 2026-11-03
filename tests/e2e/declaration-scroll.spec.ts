import { expect, test, type Page } from "@playwright/test";

async function openDeclaration(page: Page, touch = false) {
  const shield = page.getByRole("button", { name: "Read the Declaration of Independence", exact: true });
  await expect(shield).toBeVisible();
  const pin = (await shield.locator(":scope > span").boundingBox())!;
  if (touch) await page.touchscreen.tap(pin.x, pin.y);
  else await page.mouse.click(pin.x, pin.y);
  await expect(page.getByRole("dialog", { name: "Declaration of Independence", exact: true })).toBeVisible();
}

test("the shield opens the full Declaration, scrolls independently, and returns focus", async ({ page, isMobile }) => {
  const errors: string[] = [], models: string[] = [], fonts: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.url().includes("/workshop/") && request.url().endsWith(".glb")) models.push(request.url());
    if (request.url().includes("/fonts/declaration/")) fonts.push(request.url());
  });
  await page.goto("/#projects");
  await expect(page.locator('[data-curio="shield"]')).toBeVisible();
  expect(fonts).toEqual([]);
  const scrollY = await page.evaluate(() => window.scrollY);
  await openDeclaration(page, isMobile);
  const dialog = page.locator("[data-declaration]");
  const paper = page.locator("[data-declaration-paper]");
  await expect(page.getByRole("heading", { name: "Declaration of Independence", exact: true })).toBeFocused();
  await expect(page.locator("[data-declaration-text] p")).toHaveCount(37);
  await expect(dialog.getByText(/We hold these truths to be self-evident/)).toBeVisible();
  await expect(dialog.getByText(/we mutually pledge to each other our Lives, our Fortunes and our sacred Honor/)).toHaveCount(1);
  await expect(dialog.getByRole("region", { name: "Signers", exact: true }).locator("p")).toHaveCount(56);
  await expect(dialog.getByRole("link", { name: "National Archives transcript" })).toHaveAttribute("href", "https://www.archives.gov/founding-docs/declaration-transcript");
  expect(models).toEqual([]);
  await page.keyboard.press("PageDown");
  await expect.poll(() => paper.evaluate(node => node.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  // The close button stays reachable even at the end of the long document.
  await dialog.getByRole("link", { name: "View original" }).focus();
  await expect(dialog.getByText("Matthew Thornton", { exact: true })).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "Close Declaration" })).toBeInViewport();
  await dialog.getByRole("button", { name: "Close Declaration" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-curio="shield"]')).toBeFocused();
  await expect(page.locator('[data-curio="shield"]')).toHaveCSS("outline-style", "none");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-overlay");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await openDeclaration(page, isMobile);
  await expect.poll(() => paper.evaluate(node => node.scrollTop)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the scroll supports keyboard, reduced motion, and a missing decorative font", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/fonts/declaration/**", route => route.abort());
  await page.goto("/#projects");
  const shield = page.locator('[data-curio="shield"]');
  await expect(page.locator('#projects')).toHaveAttribute("data-active", "true");
  await expect(page.locator('#projects')).not.toHaveAttribute("inert");
  await expect(shield).toBeVisible();
  await shield.focus(); await expect(shield).toBeFocused(); await page.keyboard.press("Enter");
  const dialog = page.locator("[data-declaration]");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Declaration of Independence", exact: true })).toBeFocused();
  await expect.poll(() => dialog.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("link", { name: "National Archives transcript" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("link", { name: "View original" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close Declaration" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "View original" })).toBeFocused();
  if (!isMobile) await page.setViewportSize({ width: 320, height: 568 });
  // The curled paper edges overhang the dialog by 5px, inside its gutters.
  expect(await dialog.evaluate(node => {
    const box = node.getBoundingClientRect();
    return box.left >= 5 && box.right <= innerWidth - 5;
  })).toBe(true);
  expect(await page.locator("[data-declaration-paper]").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(shield).toBeFocused();
  await openDeclaration(page, isMobile);
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
});

test("a phone swipe scrolls the parchment without moving the island", async ({ page, context }, info) => {
  test.skip(info.project.name !== "mobile", "Chromium exposes native touch swipes.");
  await page.goto("/#projects");
  await openDeclaration(page, true);
  const paper = page.locator("[data-declaration-paper]");
  const initial = await page.evaluate(() => window.scrollY);
  const bounds = (await paper.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height * .75;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - step * 24 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => paper.evaluate(node => node.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(initial);
  await page.getByRole("button", { name: "Close Declaration" }).click();
  await expect(page.locator('[data-curio="shield"]')).toBeFocused();
});
