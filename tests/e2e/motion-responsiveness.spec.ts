import { expect, test } from "@playwright/test";

test("navigation keeps the camera on the current scroll frame and accepts a new destination", async ({ page }) => {
  // Isolate input/frame synchronization from optional 3D decoding. Full-media
  // frame pacing is measured separately by the scrolling performance probe.
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", {
    configurable: true, value: Object.assign(new EventTarget(), { saveData: true }),
  }));
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await page.evaluate(() => {
    const probe = window as Window & { cameraErrors?: number[] };
    probe.cameraErrors = [];
    const scroll = window.scrollTo.bind(window);
    window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
      scroll(...args);
      queueMicrotask(() => {
        const stage = document.querySelector<HTMLElement>("[data-island-stage]")!;
        if (!stage.dataset.navigating) return;
        const progress = scrollY / (document.documentElement.scrollHeight - innerHeight);
        probe.cameraErrors!.push(Math.abs(Number(stage.dataset.cameraProgress) - progress));
      });
    }) as typeof window.scrollTo;
  });
  await page.getByRole("button", { name: "Show Projects island" }).click();
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-navigating");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  const errors = await page.evaluate(() => (window as Window & { cameraErrors?: number[] }).cameraErrors ?? []);
  // Frame count depends on refresh rate and load; every rendered sample must
  // still match the real scroll position, including after a slow frame.
  expect(errors.length).toBeGreaterThan(0);
  expect(Math.max(...errors)).toBeLessThan(0.00001);

  // A second choice takes over immediately rather than queueing another trip.
  await page.getByRole("button", { name: "Show Work island" }).click();
  await page.getByRole("button", { name: "Show Writing island" }).click();
  await expect(page).toHaveURL(/#writing$/);
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-navigating");
});

test("optional island models wait until scrolling inside a hold is quiet", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", {
    configurable: true, value: Object.assign(new EventTarget(), { saveData: true }),
  }));
  const models: string[] = [];
  await page.route("**/orbit-*.glb", route => { models.push(route.request().url()); return route.abort(); });
  await page.goto("/2.0#work");
  // Phones load a model only on intent; desktops preload Taipei.
  await page.locator("#work [data-island-link]").focus();
  const stage = page.locator("[data-island-stage]");
  await page.evaluate(() => scrollBy({ top: 1, behavior: "instant" }));
  await expect(stage).toHaveAttribute("data-scrolling", "true");
  await page.evaluate(async () => {
    const connection = (navigator as Navigator & { connection: EventTarget & { saveData: boolean } }).connection;
    connection.saveData = false;
    connection.dispatchEvent(new Event("change"));
    const start = scrollY;
    const began = performance.now();
    await new Promise<void>(resolve => {
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / 600);
        scrollTo({ top: start + t * 35, behavior: "instant" });
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  });
  expect(models).toEqual([]);
  await expect.poll(() => models.length).toBeGreaterThan(0);
  expect(models.every(url => url.includes("orbit-work-"))).toBe(true);
});

test("downward pointer movement does not flip the rocket from side to side", async ({ page, isMobile }) => {
  test.skip(isMobile, "Requires a fine pointer.");
  await page.goto("/writing");
  await expect(page.locator("body")).toHaveClass(/rocket-cursor-active/);
  const angles = await page.evaluate(async () => {
    const samples: number[] = [];
    const move = (x: number, y: number) => document.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, pointerType: "mouse", pointerId: 1, isPrimary: true, clientX: x, clientY: y,
    }));
    move(300, 100);
    for (let i = 0; i < 24; i++) {
      move(300 + (i % 2 ? .1 : -.1), 110 + i * 5);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const ship = document.querySelector<HTMLElement>('[data-testid="rocket-ship"]')!;
      const matrix = new DOMMatrix(getComputedStyle(ship).transform);
      samples.push(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI);
    }
    return samples;
  });
  expect(Math.max(...angles.map(Math.abs))).toBeLessThan(1);
  await expect(page.getByTestId("rocket-effects-canvas")).toHaveAttribute("data-animation-state", "idle");
});

test("a tablet can switch between trackpad and touch without a stranded cursor", async ({ page, isMobile }) => {
  test.skip(isMobile, "The desktop engine supplies fine-pointer capability for mixed input.");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/writing");
  await expect(page.locator("body")).toHaveClass(/rocket-cursor-active/);
  await page.mouse.move(350, 200);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, button: 0, isPrimary: true, pointerType: "touch", pointerId: 2, clientX: 400, clientY: 300,
  })));
  await expect(page.locator("body")).not.toHaveClass(/rocket-cursor-active/);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "0");
  await page.mouse.move(450, 250);
  await expect(page.locator("body")).toHaveClass(/rocket-cursor-active/);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
  const point = await page.getByTestId("rocket-cursor").evaluate(el => {
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    return { x: matrix.m41, y: matrix.m42 };
  });
  expect(point).toEqual({ x: 450, y: 250 });
});
