import { expect, test, type Locator, type Page } from "@playwright/test";

async function clickObject(page: Page, object: Locator, touch: boolean) {
  // These targets intentionally float. Hit the visible marker, as a visitor
  // does, instead of waiting for an animated element to stop moving.
  await expect(object).toBeVisible();
  const pin = await object.evaluate(node => {
    const box = node.querySelector("span")!.getBoundingClientRect();
    return { x: box.x, y: box.y };
  });
  if (touch) await page.touchscreen.tap(pin.x, pin.y);
  else await page.mouse.click(pin.x, pin.y);
}

const destinations = {
  stocker: "https://stocker-app-one.vercel.app/",
  "taipei-guide": "https://taipei-guide-etaa.vercel.app/",
  "night-night-ko": "https://nightnightko.vercel.app/",
};

test("every physical project object opens its own destination without leaving the workshop", async ({ page, context, isMobile }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // Exercise real clicks and new tabs, without depending on third-party uptime.
  for (const href of Object.values(destinations)) await context.route(href, route => route.fulfill({ contentType: "text/html", body: "<title>Project destination</title><p>Project opened.</p>" }));
  await page.goto("/#projects");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  const objects = page.locator("#projects [data-workshop-object]");
  await expect(objects).toHaveCount(5);
  await expect(page.locator('[data-workshop-object="taipei-flix"], [data-workshop-object="ikigai-timer"], [data-curio="flix-print"]')).toHaveCount(0);
  await expect(page.locator('[data-curio="run-print"]')).toHaveCount(0);
  const stocker = (await page.locator('[data-workshop-object="stocker"]').boundingBox())!;
  const ipad = (await page.locator('[data-curio="ipad"]').boundingBox())!;
  expect(stocker.y + stocker.height).toBeLessThan(ipad.y);
  await expect(page.locator('#projects a[href="https://886studios.com"]')).toHaveCount(0);
  await expect(page.locator("#projects [data-island-visual]")).toHaveAttribute("data-parallax", "on", { timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-rocket-transition", "idle");
  for (const [id, href] of Object.entries(destinations)) {
    const object = page.locator(`[data-workshop-object="${id}"]`);
    await expect(object).toHaveAccessibleName(/.+\(opens in a new tab\)$/);
    // The center of each physical object must remain clickable on small screens.
    expect(await object.evaluate(node => {
      const pin = node.querySelector("span")!.getBoundingClientRect();
      return node.contains(document.elementFromPoint(pin.x, pin.y));
    }), `${id} should receive clicks at its object marker`).toBe(true);
    const popupPromise = page.waitForEvent("popup");
    await clickObject(page, object, isMobile);
    const popup = await popupPromise;
    await expect(popup).toHaveURL(href);
    await popup.close();
    await expect(page).toHaveURL(/\/#projects$/);
    await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  }
  await page.mouse.move(1, 1);
  await page.screenshot({ path: `/tmp/carter-workshop-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
});

test("the chip case plays four scored hands, replays, and restores keyboard focus", async ({ page, isMobile }, testInfo) => {
  await page.goto("/#projects");
  const cards = page.getByRole("button", { name: "Poker Odds", exact: true });
  await expect(cards).toBeVisible();
  // Compare the artwork with the iPad's anchor, not the padded mobile hit
  // areas, which are deliberately larger than the miniature objects.
  const caseBox = (await cards.locator('[data-project-cue]').boundingBox())!;
  const ipad = (await page.locator('[data-curio="ipad"] > span').boundingBox())!;
  expect(caseBox.y).toBeGreaterThan(ipad.y);
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-travelling", "true");
  const islandScroll = await page.evaluate(() => scrollY);
  if (isMobile) await clickObject(page, cards, true); else { await cards.focus(); await page.keyboard.press("Enter"); }
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close poker challenge" })).toBeFocused();
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-overlay", "true");
  // Native modal focus stays inside even when tabbing backwards.
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "Open poker calculator" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  for (const [index, answer] of ["10%", "25%", "33.3%", "40%"].entries()) {
    await expect(dialog.getByText(`Hand ${index + 1} of 4`, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: answer, exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText(index === 0 ? "The answer is 20%." : "Correct.");
    await expect(dialog.getByRole("group").getByRole("button").first()).toBeDisabled();
    if (index === 0) await page.screenshot({ path: `/tmp/carter-poker-${testInfo.project.name}.png` });
    await dialog.getByRole("button", { name: index === 3 ? "Results" : "Next", exact: true }).click();
  }
  await expect(dialog.getByRole("heading", { name: "3 of 4 correct." })).toBeVisible();
  await dialog.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(dialog.getByText("Hand 1 of 4", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(cards).toBeFocused();
  await expect(cards).toHaveCSS("outline-style", "none");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-overlay");
  expect(await page.evaluate(() => scrollY)).toBe(islandScroll);
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("objects follow the island's perspective and stay inert offstage", async ({ page, isMobile }) => {
  await page.goto("/#projects");
  const visual = page.locator("#projects [data-island-visual]");
  await expect(visual).toHaveAttribute("data-parallax", "on", { timeout: 30_000 });
  if (!isMobile) {
    const frame = (await visual.boundingBox())!;
    await page.mouse.move(frame.x + frame.width * .3, frame.y + frame.height * .3);
    await expect.poll(() => visual.locator('[data-object-position="taipei-run"]').evaluate(node => {
      const matrix = new DOMMatrix(getComputedStyle(node).transform);
      return Math.hypot(matrix.m41, matrix.m42);
    })).toBeGreaterThan(.1);
  }
  await page.getByRole("button", { name: "Show Writing island", exact: true }).click();
  await expect(page.locator("#projects")).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Poker Odds" })).toHaveCount(0);
  // Finish the existing flight before changing the OS motion preference.
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-navigating", "true");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-travelling", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Show Projects island", exact: true }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  const cards = (await page.getByRole("button", { name: "Poker Odds" }).boundingBox())!;
  // Click in place: auto-scroll into a pinned scene can move the island.
  await page.mouse.click(cards.x+cards.width/2,cards.y+cards.height/2);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close poker challenge" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  await page.locator("#projects-heading a").click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator("[data-project-shot]")).toHaveCount(8);
});
