import { expect, test } from "@playwright/test";

type CanvasProbeWindow = Window & typeof globalThis & { __rocketClears: number };
type StarfieldProbeWindow = Window & typeof globalThis & { __workGradients: number; __workFrames: number };

test("hovering keeps the cursor attached without repainting the effects canvas", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Pointer rendering requires a fine pointer.");

  await page.addInitScript(() => {
    (window as CanvasProbeWindow).__rocketClears = 0;
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.dataset.testid === "rocket-effects-canvas") {
        (window as CanvasProbeWindow).__rocketClears += 1;
      }
      return clearRect.apply(this, args);
    };
  });

  for (const route of ["/", "/work", "/writing", "/projects"]) {
    await page.goto(route);
    await expect(page.locator("body")).toHaveClass(/rocket-cursor-active/);
    const link = page.getByLabel("Primary navigation").getByRole("link").first();
    await link.hover();
    const canvas = page.getByTestId("rocket-effects-canvas");
    await expect(canvas).toHaveAttribute("data-animation-state", "idle");
    await expect(page.locator(".rocket-hover-ring")).toHaveCSS("opacity", "1");

    const result = await link.evaluate(async (target) => {
      const probe = window as CanvasProbeWindow;
      const cursor = document.querySelector<HTMLElement>("[data-testid=rocket-cursor]")!;
      const rect = target.getBoundingClientRect();
      let maxPositionError = 0;
      probe.__rocketClears = 0;
      for (let frame = 0; frame < 40; frame++) {
        await new Promise(requestAnimationFrame);
        const x = rect.x + rect.width / 2 + Math.sin(frame / 5) * 3;
        const y = rect.y + rect.height / 2;
        target.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true, isPrimary: true, pointerType: "mouse", pointerId: 1,
          clientX: x, clientY: y,
        }));
        // Inspect the written transform synchronously, before any paint.
        const matrix = new DOMMatrixReadOnly(cursor.style.transform);
        maxPositionError = Math.max(maxPositionError, Math.abs(matrix.m41 - x), Math.abs(matrix.m42 - y));
      }
      return { clears: probe.__rocketClears, maxPositionError };
    });
    expect(result.clears, `${route}: hover should use only the cursor layer`).toBe(0);
    expect(result.maxPositionError).toBeLessThan(0.01);
    await expect(canvas).toHaveAttribute("data-animation-state", "idle");
  }
});

test("effects near viewport edges leave no canvas residue", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop particle and streak effects.");
  await page.goto("/work");
  await expect(page.locator("body")).toHaveClass(/rocket-cursor-active/);
  await page.mouse.move(10, 680);
  await page.mouse.move(1260, 680);
  // A decorative launch near the edge exercises clipped particle, flame, and
  // shockwave bounds without leaving the route or opening an outbound link.
  await page.locator(".legacy-work-root").dispatchEvent("click", { clientX: 1260, clientY: 680 });
  const canvas = page.getByTestId("rocket-effects-canvas");
  await expect(canvas).toHaveAttribute("data-transition-phase", "launching");
  await expect(canvas).toHaveAttribute("data-transition-phase", "idle");
  await expect(canvas).toHaveAttribute("data-animation-state", "idle");
  const hasResidue = await canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) return true;
    }
    return false;
  });
  expect(hasResidue).toBe(false);
});

test("Work background stops and resumes when reduced motion changes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop background animation preference.");
  await page.goto("/work");
  const canvas = page.getByTestId("work-starfield");
  await expect(canvas).toHaveAttribute("data-animation-state", "running");
  await page.mouse.move(300, 200);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveAttribute("data-animation-state", "idle");
  const staticFrame = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await page.waitForTimeout(150);
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(staticFrame);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(canvas).toHaveAttribute("data-animation-state", "running");
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(staticFrame);
  // The first sample after re-enabling can equal the last known point. It must
  // still reveal the cursor, even though duplicate motion is normally skipped.
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointermove", {
    bubbles: true, isPrimary: true, pointerType: "mouse", pointerId: 1,
    clientX: 300, clientY: 200,
  })));
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
});

test("scrolling the Work starfield reuses gradients while continuing to animate", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Animated desktop star trails.");
  await page.addInitScript(() => {
    const probe = window as StarfieldProbeWindow;
    probe.__workGradients = 0;
    probe.__workFrames = 0;
    const prototype = CanvasRenderingContext2D.prototype;
    const radial = prototype.createRadialGradient;
    const linear = prototype.createLinearGradient;
    const clear = prototype.clearRect;
    prototype.createRadialGradient = function (...args) {
      if (this.canvas.dataset.testid === "work-starfield") probe.__workGradients += 1;
      return radial.apply(this, args);
    };
    prototype.createLinearGradient = function (...args) {
      if (this.canvas.dataset.testid === "work-starfield") probe.__workGradients += 1;
      return linear.apply(this, args);
    };
    prototype.clearRect = function (...args) {
      if (this.canvas.dataset.testid === "work-starfield") probe.__workFrames += 1;
      return clear.apply(this, args);
    };
  });
  await page.goto("/work");
  await expect(page.getByTestId("work-starfield")).toHaveAttribute("data-animation-state", "running");
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => (
    window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
  ))).toBeGreaterThan(0.5);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const probe = window as StarfieldProbeWindow;
    probe.__workGradients = 0;
    probe.__workFrames = 0;
  });
  await expect.poll(() => page.evaluate(() => (window as StarfieldProbeWindow).__workFrames)).toBeGreaterThan(5);
  expect(await page.evaluate(() => (window as StarfieldProbeWindow).__workGradients)).toBe(0);
});
