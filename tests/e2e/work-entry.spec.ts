import { expect, test } from "@playwright/test";

// Freeze the camera clock so assertions sample physical positions rather than
// racing a brief animation. Extend only the recovery timer while inspecting it.
async function holdCamera(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const timer = window.setTimeout;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
      timer(handler, delay === 8000 ? 120000 : delay, ...args)) as typeof window.setTimeout;
    const observer = new MutationObserver(() => {
      const overlay = document.querySelector("body > [data-work-transition]");
      const animation = overlay?.getAnimations()[0];
      if (animation) { animation.pause(); animation.currentTime = 0; observer.disconnect(); }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

test("Work approaches its actual 3D window after orbiting, then reveals the same content inside", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await holdCamera(page);
  await page.goto("/2.0#work");
  await expect(page.locator('[data-island-orbit="work"]')).toHaveAttribute("data-orbit-ready", "true", { timeout: 60000 });
  await page.locator("#work [data-island-link]").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  const carry = page.locator("body > [data-work-transition]");
  await expect(carry).toHaveAttribute("data-work-camera", "3d");
  await expect(carry.locator("canvas[data-window-camera]")).toHaveCount(1);
  // Its first projected opening exactly matches the window on the turned tower.
  const error = await page.evaluate(() => {
    const source = document.querySelector<SVGGraphicsElement>("#work [data-city-entry-window]")!;
    const matrix = source.getScreenCTM()!;
    const actual: number[][] = JSON.parse(document.querySelector<HTMLElement>("[data-city-window]")!.dataset.corners!);
    const expected: number[][] = JSON.parse(source.dataset.corners!);
    return Math.max(...expected.map(([x,y],i) => Math.hypot(actual[i][0] - (matrix.a*x + matrix.c*y + matrix.e), actual[i][1] - (matrix.b*x + matrix.d*y + matrix.f))));
  });
  expect(error).toBeLessThan(3);
  let previousArea = 0;
  let windowHeadingWidth = 0;
  for (const progress of [.4, .75, .99]) {
    await carry.evaluate((element, progress) => { const animation = element.getAnimations()[0]; animation.currentTime = progress * Number(animation.effect!.getTiming().duration); }, progress);
    await expect(carry).toHaveAttribute("data-work-progress", progress.toFixed(3));
    const points: number[][] = JSON.parse((await carry.locator("[data-city-window]").getAttribute("data-corners"))!);
    const area = Math.abs((points[1][0] - points[0][0]) * (points[2][1] - points[0][1]));
    expect(area).toBeGreaterThan(previousArea);
    previousArea = area;
    if (progress === .75) {
      // Readable Work content stays level even when entry starts after orbiting.
      const pose = await carry.locator("[data-work-preview]").evaluate(node => {
        const matrix = new DOMMatrix(getComputedStyle(node).transform);
        return { flat: matrix.is2D, skewX: matrix.c, skewY: matrix.b };
      });
      expect(pose).toEqual({ flat: true, skewX: 0, skewY: 0 });
      // The whole heading is already visible inside the opening, scaled to
      // that window rather than clipped out of a full-size page behind it.
      const heading = (await carry.locator("h1").boundingBox())!;
      windowHeadingWidth = heading.width;
      const polygon = [points[0], points[1], points[3], points[2]];
      for (const [x, y] of [[heading.x, heading.y], [heading.x + heading.width, heading.y], [heading.x, heading.y + heading.height], [heading.x + heading.width, heading.y + heading.height]]) {
        const edges = polygon.map((a, i) => {
          const b = polygon[(i + 1) % polygon.length];
          return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        });
        expect(edges.every(value => value >= 0) || edges.every(value => value <= 0)).toBe(true);
      }
    }
  }
  const final: number[][] = JSON.parse((await carry.locator("[data-city-window]").getAttribute("data-corners"))!);
  expect(Math.min(...final.map(p=>p[0]))).toBeLessThan(0);
  expect(Math.max(...final.map(p=>p[0]))).toBeGreaterThan(page.viewportSize()!.width);
  expect(Math.min(...final.map(p=>p[1]))).toBeLessThan(0);
  expect(Math.max(...final.map(p=>p[1]))).toBeGreaterThan(page.viewportSize()!.height);
  const preview = await carry.locator("h1").boundingBox();
  expect(windowHeadingWidth).toBeLessThan(preview!.width * .9);
  await carry.evaluate(element => element.getAnimations()[0].play());
  await expect(page).toHaveURL(/\/work$/);
  await expect(carry).toHaveCount(0);
  const heading = page.getByRole("heading", { name: "Work", exact: true, level: 1 });
  await expect(heading).toBeFocused();
  const destination = await heading.boundingBox();
  expect(Math.abs(preview!.x - destination!.x)).toBeLessThan(1);
  expect(Math.abs(preview!.y - destination!.y)).toBeLessThan(1);
  expect(Math.abs(preview!.width - destination!.width)).toBeLessThan(1);
  await expect(page.getByRole("heading", { name: "886 Studios", exact: true })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-work-transition");
  await page.goBack();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  expect(errors).toEqual([]);
});

test("a missing 3D model uses the same lit window without blocking Work", async ({ page }) => {
  await page.route("**/orbit-*.glb", route => route.abort());
  await holdCamera(page);
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await expect(page.locator("#work [data-island-link]")).toBeVisible();
  await page.locator("#work [data-island-link]").focus();
  await expect(page.locator("#work [data-island-link]")).toBeFocused();
  await page.keyboard.press("Enter");
  const carry = page.locator("body > [data-work-transition]");
  await expect(carry).toHaveAttribute("data-work-camera", "still");
  await expect(carry.locator("svg image")).toHaveCount(1);
  await carry.evaluate(el => { const a=el.getAnimations()[0]; a.currentTime=Number(a.effect!.getTiming().duration)*.75; });
  await expect(carry).toHaveAttribute("data-work-progress", "0.750");
  const points: number[][] = JSON.parse((await carry.locator("[data-city-window]").getAttribute("data-corners"))!);
  // The poster and opening square up together before the readable close-up.
  expect(Math.abs(points[0][1] - points[1][1])).toBeLessThan(.1);
  expect(Math.abs(points[0][0] - points[2][0])).toBeLessThan(.1);
  const pose = await carry.locator("[data-work-preview]").evaluate(node => {
    const matrix = new DOMMatrix(getComputedStyle(node).transform);
    return { flat: matrix.is2D, skewX: matrix.c, skewY: matrix.b };
  });
  expect(pose).toEqual({ flat: true, skewX: 0, skewY: 0 });
  await carry.evaluate(el => { const a=el.getAnimations()[0]; a.currentTime=Number(a.effect!.getTiming().duration)*.98; a.play(); });
  await expect(page).toHaveURL(/\/work$/);
  await expect(carry).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Work", exact: true, level: 1 })).toBeFocused();
});

test("Escape cancels the camera, restores the island, and permits another entry", async ({ page }) => {
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  const heading = page.locator("#work-heading a");
  await heading.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  await expect(page).toHaveURL(/\/2\.0#work$/);
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
  await expect(page.locator("#work [data-island-visual] > img")).toBeVisible();
  await heading.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Work", exact: true, level: 1 })).toBeFocused();
});

test("direct and reduced-motion Work entries remain complete and immediately usable", async ({ page }) => {
  await page.goto("/work");
  await expect(page.getByRole("heading", { name: "Work", exact: true, level: 1 })).toBeVisible();
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await expect(page.locator("#work [data-scene-copy]")).toHaveCSS("opacity", "1");
  // WebKit can paint the scene's children a frame after its active state.
  await expect(page.locator("#work [data-island-link]")).toBeVisible();
  await page.locator("#work [data-island-link]").focus();
  await expect(page.locator("#work [data-island-link]")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "886 Studios", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-work-arrival]")).toBeVisible();
});

test("changing the motion preference during the approach skips cleanly to Work", async ({ page }) => {
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await page.locator("#work [data-island-link]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.locator("[data-work-arrival]")).toBeVisible();
});
