import { expect, test, type Page } from "@playwright/test";

// Playwright WebKit cannot synthesize a native pinch. Exercise its touch
// lifecycle separately; Chromium also verifies real compositor zoom below.
async function touches(page: Page, type: string, count: number) {
  await page.evaluate(({ type, count }) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, "touches", { value: Array.from({ length: count }, (_, identifier) => ({ identifier })) });
    window.dispatchEvent(event);
  }, { type, count });
}

async function ready(page: Page, world: string) {
  await page.goto(`/#${world}`);
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-travelling", "false");
  await expect(page.getByRole("button", { name: "Show Work island" })).toBeEnabled();
}

for (const world of ["work", "writing", "projects"]) {
  test(`native pinch and pan preserve ${world}, then restore normal travel`, async ({ page, context, browserName, isMobile }, testInfo) => {
    test.skip(!isMobile || browserName !== "chromium", "Native pinch injection requires mobile Chromium CDP.");
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await ready(page, world);
    const originalY = await page.evaluate(() => scrollY);
    const stage = page.locator("[data-island-stage]");
    const session = await context.newCDPSession(page);
    await session.send("Input.synthesizePinchGesture", { x: 195, y: 430, scaleFactor: 2, relativeSpeed: 800, gestureSourceType: "touch" });
    await expect.poll(() => page.evaluate(() => visualViewport!.scale)).toBeGreaterThan(1.9);
    await expect(stage).toHaveAttribute("data-zoomed", "true");
    await expect(page.locator("html")).not.toHaveAttribute("data-island-swipe");
    const held = await stage.getAttribute("data-camera-progress");
    const art = page.locator(`#${world} [data-scene-art]`);
    const transform = await art.evaluate(node => getComputedStyle(node).transform);
    // Cross both the visual viewport's edge and multiple island boundaries.
    for (const distance of [-500, -900, 700]) {
      await session.send("Input.synthesizeScrollGesture", { x: 180, y: 350, yDistance: distance, speed: 800, gestureSourceType: "touch" });
      await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
      await expect(stage).toHaveAttribute("data-camera-progress", held!);
      await expect(stage).toHaveAttribute("data-travelling", "false");
      await expect(stage).not.toHaveAttribute("data-entering");
      await expect(art).toHaveCSS("transform", transform);
      await expect(page.locator(`#${world} [data-scene-copy]`)).toHaveCSS("opacity", "1");
      await expect(page).toHaveURL(new RegExp(`#${world}$`));
    }
    await page.screenshot({ path: testInfo.outputPath(`${world}-zoomed.png`) });
    const center = await page.evaluate(() => ({ x: visualViewport!.width / 2, y: visualViewport!.height / 2 }));
    await session.send("Input.synthesizePinchGesture", { ...center, scaleFactor: 0.5, relativeSpeed: 800, gestureSourceType: "touch" });
    await expect.poll(() => page.evaluate(() => visualViewport!.scale)).toBeLessThan(1.01);
    await expect(stage).not.toHaveAttribute("data-zoomed");
    await expect(page.locator("html")).toHaveAttribute("data-island-swipe", "true");
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(originalY, 0);
    const next = world === "writing" ? "Projects" : "Writing";
    await page.getByRole("button", { name: `Show ${next} island` }).click();
    await expect(page).toHaveURL(new RegExp(`#${next.toLowerCase()}$`));
    await expect(stage).not.toHaveAttribute("data-navigating");
    expect(errors).toEqual([]);
    await session.detach();
  });
}

test("a two-finger gesture stays paused until the final finger lifts or cancels", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch gesture lifecycle.");
  await ready(page, "work");
  const originalY = await page.evaluate(() => scrollY);
  const stage = page.locator("[data-island-stage]");
  await touches(page, "touchstart", 1);
  await touches(page, "touchstart", 2);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await touches(page, "touchend", 1);
  await page.evaluate(() => scrollBy({ top: 900, behavior: "instant" }));
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await touches(page, "touchcancel", 0);
  await expect(stage).not.toHaveAttribute("data-zoomed");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(originalY, 0);
  await page.getByRole("button", { name: "Show Projects island" }).click();
  await expect(page).toHaveURL(/#projects$/);
});

test("pinching during a crossing reveals a complete island instead of a dim travel frame", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch gesture lifecycle.");
  await ready(page, "work");
  await page.evaluate(() => {
    document.documentElement.style.scrollSnapType = "none";
    scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * (1.6 / 4.5), behavior: "instant" });
  });
  const stage = page.locator("[data-island-stage]");
  await expect(stage).toHaveAttribute("data-travelling", "true");
  const world = await page.locator("main[data-scene]").getAttribute("data-scene");
  await touches(page, "touchstart", 2);
  await expect(stage).toHaveAttribute("data-travelling", "false");
  await expect(page.locator(`#${world} [data-scene-copy]`)).toHaveCSS("opacity", "1");
  await expect(page.locator(`#${world} [data-island-visual]`)).toHaveCSS("filter", "brightness(1)");
  await touches(page, "touchend", 0);
  await page.evaluate(() => document.documentElement.style.removeProperty("scroll-snap-type"));
  await expect(stage).not.toHaveAttribute("data-zoomed");
  await expect(page).toHaveURL(new RegExp(`#${world}$`));
});

test("pinching cancels each entry cover and leaves the island usable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch gesture lifecycle.");
  for (const world of ["work", "writing", "projects"]) {
    await ready(page, world);
    const stage = page.locator("[data-island-stage]");
    await page.locator(`#${world} [data-island-link]`).click();
    await expect(stage).toHaveAttribute("data-entering", world);
    const cover = world === "writing" ? "book" : world === "projects" ? "workshop" : "work";
    await expect(page.locator(`body > [data-${cover}-transition]`)).toHaveCount(1);
    await touches(page, "touchstart", 2);
    await expect(stage).not.toHaveAttribute("data-entering");
    await expect(page.locator("[data-entry-light]")).toHaveCount(0);
    await expect(page.locator("body > [data-book-transition], body > [data-workshop-transition], body > [data-work-transition]")).toHaveCount(0);
    await touches(page, "touchend", 0);
    await expect(stage).not.toHaveAttribute("data-zoomed");
    await expect(page.locator(`#${world} [data-scene-copy]`)).toHaveCSS("opacity", "1");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(new RegExp(`#${world}$`));
    await expect(page.locator("html")).toHaveAttribute("data-rocket-transition", "idle");
  }
  await page.locator("#projects [data-island-link]").click();
  await expect(page).toHaveURL(/\/projects$/, { timeout: 15_000 });
  await expect(page.locator("main h1")).toHaveText("Projects");
});

test("magnified navigation remains usable and cleans up on leaving the homepage", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Visual viewport lifecycle.");
  await ready(page, "work");
  // WebKit has no native pinch injection; model the browser's viewport event.
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, "scale", { configurable: true, value: 2 });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  const stage = page.locator("[data-island-stage]");
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await page.getByRole("button", { name: "Show Writing island" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await expect(stage).toHaveAttribute("data-travelling", "false");
  await page.locator("#writing [data-island-link]").click();
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.locator("main h1")).toHaveText("Writing");
  await expect(page.locator("[data-entry-light]")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-island-swipe");
  await page.evaluate(() => { delete (visualViewport as unknown as { scale?: number }).scale; });
  await page.goBack();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await expect(page.locator("html")).toHaveAttribute("data-island-swipe", "true");
});
