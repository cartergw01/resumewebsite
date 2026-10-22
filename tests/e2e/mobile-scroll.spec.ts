import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, world = "writing") {
  await page.goto(`/#${world}`);
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-travelling", "false");
  await expect(page.getByRole("button", { name: "Show Work island" })).toBeEnabled();
}

test("a short mobile drag moves the camera in either direction", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch camera has a shorter hold.");
  for (const distance of [-35, 35]) {
    await ready(page);
    await page.evaluate(distance => {
      document.documentElement.style.scrollSnapType = "none";
      scrollBy({ top: distance, behavior: "instant" });
    }, distance);
    await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-travelling", "true");
    await expect.poll(() => page.locator("#writing [data-scene-copy]").evaluate(copy => Number(getComputedStyle(copy).opacity))).toBeLessThan(.99);
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  }
});

test("mobile tab changes start immediately, finish quickly, and accept a new destination", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch controls use the faster glide.");
  await ready(page, "work");
  const timings = await page.evaluate(async () => {
    const stage = document.querySelector<HTMLElement>("[data-island-stage]")!;
    const button = document.querySelector<HTMLButtonElement>('[data-scene-button][data-scene-index="2"]')!;
    const began = performance.now(), before = scrollY;
    button.click();
    let firstMovement = 0;
    while (stage.dataset.navigating && performance.now() - began < 1200) {
      await new Promise(requestAnimationFrame);
      if (!firstMovement && Math.abs(scrollY - before) > 2) firstMovement = performance.now() - began;
    }
    return { firstMovement, finished: performance.now() - began };
  });
  expect(timings.firstMovement).toBeGreaterThan(0);
  expect(timings.firstMovement).toBeLessThan(100);
  expect(timings.finished).toBeLessThan(500);
  await expect(page).toHaveURL(/#writing$/);
  await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('[data-scene-index="3"]')!.click();
    await new Promise(requestAnimationFrame);
    document.querySelector<HTMLButtonElement>('[data-scene-index="1"]')!.click();
  });
  await expect(page).toHaveURL(/#work$/);
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-navigating");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
});

test("toolbar height changes keep artwork and scroll anchors stable without scroll corrections", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Dynamic mobile viewport resizing.");
  await ready(page);
  const result = await page.evaluate(async () => {
    const stage = document.querySelector<HTMLElement>("[data-island-stage]")!;
    const track = document.querySelector<HTMLElement>("main[data-scene]")!;
    const art = document.querySelector<HTMLElement>("#writing [data-scene-art]")!;
    const height = stage.offsetHeight, trackHeight = track.offsetHeight;
    const before = { y: scrollY, artHeight: art.offsetHeight, artTop: art.offsetTop };
    const scroll = window.scrollTo;
    let corrections = 0;
    window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => { corrections++; scroll.apply(window, args); }) as typeof window.scrollTo;
    // Model dvh changing while svh stays fixed, as the address bar collapses.
    // The scroll-range portion of the track stays the same in both directions.
    for (const change of [64, 0]) {
      stage.style.height = `${height + change}px`;
      track.style.height = `${trackHeight + change}px`;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    window.scrollTo = scroll;
    return { before, after: { y: scrollY, artHeight: art.offsetHeight, artTop: art.offsetTop }, corrections };
  });
  expect(result.after).toEqual(result.before);
  expect(result.corrections).toBe(0);
  await expect(page).toHaveURL(/#writing$/);
});

test("native drags advance and reverse without requiring a full-screen fling", async ({ page, context, browserName, isMobile }) => {
  test.skip(!isMobile || browserName !== "chromium", "Native touch injection requires Chromium CDP.");
  await ready(page, "work");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const session = await context.newCDPSession(page);
  // About a fifth of the screen is enough to move to the next island.
  for (const [distance, world] of [[-180, "writing"], [180, "work"], [-180, "writing"], [-180, "projects"], [180, "writing"]] as const) {
    await session.send("Input.synthesizeScrollGesture", { x: 195, y: distance < 0 ? 600 : 250, yDistance: distance, speed: 400, preventFling: true, gestureSourceType: "touch" });
    await expect(page).toHaveURL(new RegExp(`#${world}$`));
    await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-travelling", "false");
    await expect(page.locator(`#${world} [data-scene-copy]`)).toHaveCSS("opacity", "1");
  }
  // Reverse while the previous flick is still coasting.
  await session.send("Input.synthesizeScrollGesture", { x: 195, y: 600, yDistance: -180, speed: 1200, preventFling: false, gestureSourceType: "touch" });
  await session.send("Input.synthesizeScrollGesture", { x: 195, y: 250, yDistance: 260, speed: 1200, preventFling: false, gestureSourceType: "touch" });
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-travelling", "false");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  const world = await page.locator("main[data-scene]").getAttribute("data-scene");
  await expect(page).toHaveURL(new RegExp(`#${world}$`));
  expect(["work", "writing"]).toContain(world);
  expect(errors).toEqual([]);
  await session.detach();
});


test("mobile rotation keeps the selected island with native snapping enabled", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Native touch snap targets change with the viewport.");
  for (const world of ["work", "writing", "projects"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, world);
    for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 375 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      // Allow the resize, native re-snap and camera frame to run before checking.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
      await expect(page).toHaveURL(new RegExp(`#${world}$`));
      await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-travelling", "false");
      await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
      await expect(page.locator(`#${world} [data-scene-copy]`)).toHaveCSS("opacity", "1");
    }
  }
});
