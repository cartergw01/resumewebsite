import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, world: string) {
  await page.goto(`/2.0#${world}`);
  const canvas = page.locator(`[data-island-orbit="${world}"]`);
  await expect(canvas).toHaveAttribute("data-orbit-ready", "true", { timeout: 60_000 });
  return canvas;
}

for (const world of ["work", "writing", "projects"]) test(`dragging ${world} turns its geometry without launching; a click still enters`, async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
    const canvas = await ready(page, world);
    const surface = page.locator(`#${world} [data-corners]`).last();
    const corners = await surface.getAttribute("data-corners");
    const box = (await canvas.boundingBox())!;
    const x = Math.min(page.viewportSize()!.width - 65, box.x + box.width * .6);
    const y = box.y + box.height * .55;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 95, y + 12, { steps: 8 });
    await page.mouse.up();
    await expect(canvas).toHaveAttribute("data-orbit-live", "true");
    expect(Number(await canvas.getAttribute("data-orbit-yaw"))).toBeGreaterThan(.2);
    await expect(surface).not.toHaveAttribute("data-corners", corners!);
    await expect(page).toHaveURL(new RegExp(`/2\\.0#${world}$`));
    await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
    await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
    // Record the transient launch in-page. On software GPUs a camera frame
    // can block the test driver until the entire transition has completed.
    await page.evaluate(() => {
      const probe = window as Window & { sawOrbitLaunch?: boolean };
      probe.sawOrbitLaunch = false;
      const rocket = document.querySelector<HTMLElement>('[data-testid="rocket-cursor"]')!;
      const observer = new MutationObserver(() => {
        if (rocket.dataset.transitionPhase === "launching") { probe.sawOrbitLaunch = true; observer.disconnect(); }
      });
      observer.observe(rocket, { attributes: true, attributeFilter: ["data-transition-phase"] });
    });
    await page.mouse.click(x - 95, y + 12);
    await expect.poll(() => page.evaluate(() => (window as Window & { sawOrbitLaunch?: boolean }).sawOrbitLaunch)).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/${world}$`));
    await expect(page.getByRole("heading", { name: new RegExp(`^${world}$`, "i"), level: 1 })).toBeVisible();
    await expect(page.locator("[data-island-stage]")).toHaveCount(0);
    await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("keyboard rotation is bounded; reset restores the original view and Enter works with reduced motion", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const canvas = await ready(page, "projects");
  const original = await page.locator("#projects [data-workshop-screen]").getAttribute("data-corners");
  await page.locator("#projects [data-island-link]").focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  expect(Number(await canvas.getAttribute("data-orbit-yaw"))).toBeCloseTo(.65);
  await page.keyboard.press("ArrowUp");
  expect(Number(await canvas.getAttribute("data-orbit-pitch"))).toBeLessThan(0);
  await page.keyboard.press("r");
  await expect(canvas).not.toHaveAttribute("data-orbit-live");
  await expect(page.locator("#projects [data-workshop-screen]")).toHaveAttribute("data-corners", original!);
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Reset projects island view" }).click();
  await expect(canvas).not.toHaveAttribute("data-orbit-live");
  await expect(page).toHaveURL(/\/2\.0#projects$/);
  await page.locator("#projects [data-island-link]").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/projects$/);
});

test("a failed model leaves the original island and page navigation usable", async ({ page }) => {
  await page.route("**/orbit-*.glb", route => route.abort());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0#work");
  await expect(page.locator("#work [data-island-visual] > img")).toBeVisible();
  await expect(page.locator("#work [data-island-orbit]")).not.toHaveAttribute("data-orbit-live");
  await page.locator("#work [data-island-link]").click();
  await expect(page).toHaveURL(/\/work$/);
});

test("touch drag turns horizontally while a vertical swipe keeps native scrolling", async ({ page, context, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || !isMobile, "Native touch gestures use Chromium's device protocol.");
  test.setTimeout(90_000);
  const canvas = await ready(page, "work");
  const box = (await canvas.boundingBox())!;
  const x = 220, y = box.y + box.height * .5;
  const cdp = await context.newCDPSession(page);
  const link = page.locator('#work [data-island-link]');
  const hint = page.locator('#work [data-orbit-controls]');
  await expect(hint.getByText('swipe', { exact: true })).toBeVisible();
  await expect(page.locator('#work [data-orbit-hint]')).toBeVisible();
  const [helpBox, navBox] = await Promise.all([hint.boundingBox(), page.locator('[data-scene-nav]').boundingBox()]);
  expect(helpBox!.y + helpBox!.height).toBeLessThan(navBox!.y - 8);
  const swipe = async (dx: number, dy: number) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await expect(link).toHaveAttribute('data-touch-pressed', 'true');
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx*i/8, y: y + dy*i/8 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(link).not.toHaveAttribute('data-touch-pressed');
  };
  await swipe(-95, 0);
  await expect(canvas).toHaveAttribute("data-orbit-live", "true");
  expect(Number(await canvas.getAttribute("data-orbit-yaw"))).toBeGreaterThan(.2);
  await expect(page).toHaveURL(/\/2\.0#work$/);
  await expect(page.locator('#work [data-orbit-hint]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset work island view' })).toBeVisible();
  const scroll = await page.evaluate(() => scrollY);
  await swipe(0, -160);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll + 80);
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
});

test("losing the graphics context restores the poster and its original entry corners", async ({ page }) => {
  test.setTimeout(90_000);
  const canvas = await ready(page, "projects");
  const surface = page.locator("#projects [data-workshop-screen]");
  const original = await surface.getAttribute("data-corners");
  const link = page.locator("#projects [data-island-link]");
  await link.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(surface).not.toHaveAttribute("data-corners", original!);
  await canvas.dispatchEvent("webglcontextlost", { cancelable: true });
  await expect(canvas).not.toHaveAttribute("data-orbit-live");
  await expect(canvas).not.toHaveAttribute("data-orbit-ready");
  await expect(surface).toHaveAttribute("data-corners", original!);
  await expect(link).not.toHaveAttribute("aria-describedby");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/projects$/);
});

test("dragging before the model is ready does not navigate or hide the poster", async ({ page }) => {
  let release: () => void = () => {};
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/orbit-*.glb", async route => { await hold; await route.abort(); });
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  const canvas = page.locator('[data-island-orbit="work"]');
  await expect(canvas).toHaveCount(1);
  const box = (await page.locator("#work [data-island-link]").boundingBox())!;
  const x = Math.min(page.viewportSize()!.width - 45, box.x + box.width * .6), y = box.y + box.height * .55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 80, y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  await expect(canvas).not.toHaveAttribute("data-orbit-live");
  await expect(page).toHaveURL(/\/2\.0#work$/);
  release();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.click(x, y);
  await expect(page).toHaveURL(/\/work$/);
});
