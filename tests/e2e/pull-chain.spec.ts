import { expect, test } from "@playwright/test";

async function study(page: import("@playwright/test").Page) {
  await page.goto("/#writing");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  const chain = page.getByRole("switch", { name: "study lights" });
  await expect(chain).toBeVisible();
  const box = (await chain.boundingBox())!;
  return { chain, x: box.x + box.width / 2, y: box.y + 38 };
}

test("sideways play bends the cord, swings back, and never toggles the lights", async ({ page }) => {
  const { chain, x, y } = await study(page);
  const anchor = await chain.locator("svg").boundingBox();
  const initial = await chain.locator("[data-bead]").boundingBox();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 10, { steps: 10 });
  const bead = (await chain.locator("[data-bead]").boundingBox())!;
  expect(bead.x - initial!.x).toBeGreaterThan(20);
  expect(await chain.locator("svg").boundingBox()).toEqual(anchor);
  await page.mouse.up();
  await expect(chain).toHaveAttribute("aria-checked", "true");
  // A real overshoot, followed by a finite return to rest.
  await expect.poll(() => chain.evaluate(el => parseFloat((el as HTMLElement).style.getPropertyValue("--cord-x"))), { intervals: [20] }).toBeLessThan(-0.5);
  await expect.poll(() => chain.evaluate(el => (el as HTMLElement).style.getPropertyValue("--cord-x"))).toBe("0px");
  await expect(chain).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
});

test("cancelled and lost-capture pulls reset without toggling", async ({ page }) => {
  const { chain, x, y } = await study(page);
  for (const event of ["pointercancel", "lostpointercapture"]) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 10, y + 40, { steps: 6 });
    const id = await chain.evaluate(el => {
      for (let id = 0; id < 10; id++) if (el.hasPointerCapture(id)) return id;
      return -1;
    });
    expect(id).toBeGreaterThanOrEqual(0);
    if (event === "lostpointercapture") await chain.evaluate((el, id) => el.releasePointerCapture(id), id);
    else await chain.dispatchEvent(event, { pointerId: id });
    await page.mouse.up();
    await expect(chain).not.toHaveAttribute("data-dragging");
    await expect.poll(() => chain.evaluate(el => (el as HTMLElement).style.getPropertyValue("--cord-x"))).toBe("0px");
    await expect(chain).toHaveAttribute("aria-checked", "true");
  }
});

test("reduced motion snaps back and keyboard activation still works after dragging", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { chain, x, y } = await study(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y, { steps: 5 });
  await page.mouse.up();
  expect(await chain.evaluate(el => (el as HTMLElement).style.getPropertyValue("--cord-x"))).toBe("0px");
  await expect(chain).toHaveAttribute("aria-checked", "true");
  await chain.focus();
  await page.keyboard.press("Space");
  await expect(chain).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Enter");
  await expect(chain).toHaveAttribute("aria-checked", "true");
});

test("touch drags play sideways and a deliberate pull toggles once", async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || !isMobile, "Uses Chromium touch input; keyboard and mouse paths run across engines.");
  const { chain, x, y } = await study(page);
  const session = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", dx = 0, dy = 0) => session.send("Input.dispatchTouchEvent", {
    type, touchPoints: type === "touchEnd" ? [] : [{ x: x + dx, y: y + dy }],
  });
  await touch("touchStart");
  await touch("touchMove", 65, 5);
  await expect(chain).toHaveAttribute("data-dragging");
  await touch("touchEnd");
  await expect(chain).toHaveAttribute("aria-checked", "true");
  await touch("touchStart");
  await touch("touchMove", 8, 40);
  await touch("touchEnd");
  await expect(chain).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await session.detach();
});

test("a swipe up that starts on the chain pages on and leaves the light alone", async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || !isMobile, "Uses Chromium touch input.");
  const { x, y } = await study(page);
  const session = await page.context().newCDPSession(page);
  // The chain sits where a thumb starts a swipe, under the island.
  await session.send("Input.synthesizeScrollGesture", { x, y, yDistance: -180, speed: 800, preventFling: true, gestureSourceType: "touch" });
  await expect(page).toHaveURL(/#projects$/);
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-travelling", "false");
  // Writing is off screen now, so read its switch directly rather than by role.
  await expect(page.locator('#writing [role="switch"]')).toHaveAttribute("aria-checked", "true");
  await session.detach();
});

test("the cord endpoint stays at the bead center while dragging and swinging", async ({ page }) => {
  const { chain, x, y } = await study(page);
  const gap = () => chain.evaluate(el => {
    const path = el.querySelector<SVGPathElement>("[data-cord]")!;
    const end = path.getPointAtLength(path.getTotalLength());
    const point = new DOMPoint(end.x, end.y).matrixTransform(path.getScreenCTM()!);
    const bead = el.querySelector("[data-bead]")!.getBoundingClientRect();
    return Math.hypot(point.x - bead.x - bead.width / 2, point.y - bead.y - bead.height / 2);
  });
  expect(await gap()).toBeLessThan(0.1);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const [dx, dy] of [[70, 0], [-70, 0], [20, 40], [-55, 8]]) {
    await page.mouse.move(x + dx, y + dy, { steps: 6 });
    expect(await gap()).toBeLessThan(0.1);
  }
  await page.mouse.up();
  // Check every rendered frame through the complete release animation.
  const maxGap = await chain.evaluate(el => new Promise<number>(resolve => {
    const started = performance.now();
    let max = 0;
    const sample = () => {
      const path = el.querySelector<SVGPathElement>("[data-cord]")!;
      const end = path.getPointAtLength(path.getTotalLength());
      const point = new DOMPoint(end.x, end.y).matrixTransform(path.getScreenCTM()!);
      const bead = el.querySelector("[data-bead]")!.getBoundingClientRect();
      max = Math.max(max, Math.hypot(point.x - bead.x - bead.width / 2, point.y - bead.y - bead.height / 2));
      if (performance.now() - started < 1500) requestAnimationFrame(sample);
      else resolve(max);
    };
    requestAnimationFrame(sample);
  }));
  expect(maxGap).toBeLessThan(0.1);
});
