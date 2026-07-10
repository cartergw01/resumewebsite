import { expect, test, type Page } from "@playwright/test";

type RocketTestWindow = Window & {
  __rocketOpened?: string[];
  __rocketProbeMax?: number;
  __rocketProbeMaxScale?: number;
  __rocketReturnMaxScale?: number;
  __rocketReturnMinOpacity?: number;
  __rocketReturnSamples?: number;
};

const outboundPages = [
  { label: "Writing", route: "/writing", listingSelector: ".archive-row" },
  { label: "Projects", route: "/projects", listingSelector: ".project-row" },
] as const;

function consoleGuard() {
  const errors: string[] = [];

  return {
    attach(page: Page) {
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
    },
    expectClean() {
      expect(errors).toEqual([]);
    },
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    hasOverflow: document.body.scrollWidth > window.innerWidth + 1,
  }));

  expect(overflow.hasOverflow, JSON.stringify(overflow)).toBe(false);
}

async function startRocketLaunchProbe(page: Page, durationMs = 260) {
  await page.evaluate((duration) => {
    const probeWindow = window as RocketTestWindow;
    probeWindow.__rocketProbeMax = 0;
    probeWindow.__rocketProbeMaxScale = 0;
    const until = performance.now() + duration;

    const tick = () => {
      const rocket = document.querySelector<HTMLElement>("[data-testid='rocket-ship']");
      const opacity = rocket ? Number.parseFloat(getComputedStyle(rocket).opacity) || 0 : 0;
      probeWindow.__rocketProbeMax = Math.max(probeWindow.__rocketProbeMax ?? 0, opacity);
      if (rocket) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(rocket).transform);
        const scale = Math.hypot(matrix.a, matrix.b);
        probeWindow.__rocketProbeMaxScale = Math.max(probeWindow.__rocketProbeMaxScale ?? 0, scale);
      }

      if (performance.now() < until) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, durationMs);
}

async function expectRocketBecameVisible(page: Page) {
  const maxOpacity = await page.evaluate(() => {
    const probeWindow = window as RocketTestWindow;
    return probeWindow.__rocketProbeMax ?? 0;
  });

  expect(maxOpacity).toBeGreaterThan(0.5);
}

async function expectRocketReachedBalancedScale(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const probeWindow = window as RocketTestWindow;
    return probeWindow.__rocketProbeMaxScale ?? 0;
  })).toBeGreaterThan(3.05);

  const maxScale = await page.evaluate(() => {
    const probeWindow = window as RocketTestWindow;
    return probeWindow.__rocketProbeMaxScale ?? 0;
  });
  expect(maxScale).toBeLessThanOrEqual(3.3);
}

async function startRocketReturnProbe(page: Page, origin: { x: number; y: number }, durationMs = 520) {
  await page.evaluate(({ duration, point }) => {
    const probeWindow = window as RocketTestWindow;
    probeWindow.__rocketReturnMaxScale = 0;
    probeWindow.__rocketReturnMinOpacity = 1;
    probeWindow.__rocketReturnSamples = 0;
    const startedAt = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const rocket = document.querySelector<HTMLElement>("[data-testid='rocket-ship']");
      const position = document.querySelector<HTMLElement>("[data-testid='rocket-cursor']");

      if (elapsed >= 280 && rocket && position) {
        const positionMatrix = new DOMMatrixReadOnly(getComputedStyle(position).transform);
        const returnedToPointer = Math.abs(positionMatrix.m41 - point.x) < 2
          && Math.abs(positionMatrix.m42 - point.y) < 2;

        if (returnedToPointer) {
          const rocketStyle = getComputedStyle(rocket);
          const rocketMatrix = new DOMMatrixReadOnly(rocketStyle.transform);
          const scale = Math.hypot(rocketMatrix.a, rocketMatrix.b);
          const opacity = Number.parseFloat(rocketStyle.opacity) || 0;
          probeWindow.__rocketReturnMaxScale = Math.max(probeWindow.__rocketReturnMaxScale ?? 0, scale);
          probeWindow.__rocketReturnMinOpacity = Math.min(probeWindow.__rocketReturnMinOpacity ?? 1, opacity);
          probeWindow.__rocketReturnSamples = (probeWindow.__rocketReturnSamples ?? 0) + 1;
        }
      }

      if (elapsed < duration) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, { duration: durationMs, point: origin });
}

async function expectRocketReturnIsFluid(page: Page) {
  await page.waitForTimeout(230);
  const metrics = await page.evaluate(() => {
    const probeWindow = window as RocketTestWindow;
    return {
      maxScale: probeWindow.__rocketReturnMaxScale ?? 0,
      minOpacity: probeWindow.__rocketReturnMinOpacity ?? 1,
      samples: probeWindow.__rocketReturnSamples ?? 0,
    };
  });

  expect(metrics.samples).toBeGreaterThan(2);
  expect(metrics.maxScale).toBeLessThanOrEqual(1.35);
  expect(metrics.minOpacity).toBeLessThanOrEqual(0.5);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
}

test("desktop rocket launches during internal nav and lands cleanly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop cursor mode is covered by the desktop project.");

  const guard = consoleGuard();
  guard.attach(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Carter Wang" })).toBeVisible();

  await page.mouse.move(640, 360);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
  await expect(page.locator("body")).toHaveClass(/rocket-cursor-active/);

  const canvasBox = await page.getByTestId("rocket-effects-canvas").evaluate((canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return {
      backingWidth: canvas.width,
      cssWidth: Math.round(rect.width * Math.min(window.devicePixelRatio || 1, 2)),
    };
  });
  expect(canvasBox.backingWidth).toBe(canvasBox.cssWidth);

  const workLink = page.getByLabel("Primary navigation").getByRole("link", { name: "Work" });
  const box = await workLink.boundingBox();
  expect(box).not.toBeNull();

  const clickPoint = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  await startRocketLaunchProbe(page);
  await startRocketReturnProbe(page, clickPoint);
  await page.mouse.click(clickPoint.x, clickPoint.y);
  await page.waitForTimeout(70);

  await expect(page).toHaveURL("/");
  await expectRocketBecameVisible(page);
  await expectRocketReachedBalancedScale(page);

  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expect(page.getByLabel("Primary navigation").getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
  await expectRocketReturnIsFluid(page);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expectNoHorizontalOverflow(page);
  guard.expectClean();
});

test("mobile tap mode launches without a persistent cursor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile tap mode is covered by the mobile project.");

  const guard = consoleGuard();
  guard.attach(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Carter Wang" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/rocket-cursor-active/);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "0");

  const workLink = page.getByLabel("Primary navigation").getByRole("link", { name: "Work" });
  const box = await workLink.boundingBox();
  expect(box).not.toBeNull();

  await startRocketLaunchProbe(page);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.waitForTimeout(90);

  await expectRocketBecameVisible(page);
  await expectRocketReachedBalancedScale(page);
  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expect(page.getByLabel("Primary navigation").getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
  await expectNoHorizontalOverflow(page);
  guard.expectClean();
});

test("mobile world orb first tap launches to its route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile orb hit target is covered by the mobile project.");

  const guard = consoleGuard();
  guard.attach(page);

  await page.goto("/#constellation");
  await expect(page.locator(".world-card.world-work .world-orb-link")).toBeVisible();

  const orb = page.locator(".world-card.world-work .world-orb-link");
  const box = await orb.boundingBox();
  expect(box).not.toBeNull();

  await startRocketLaunchProbe(page);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.waitForTimeout(90);

  await expectRocketBecameVisible(page);
  await expectRocketReachedBalancedScale(page);
  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expectNoHorizontalOverflow(page);
  guard.expectClean();
});

for (const outboundPage of outboundPages) {
  test(`every outbound HTTP link on ${outboundPage.label} launches before opening`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Outbound link coverage runs once in the desktop project.");

    const guard = consoleGuard();
    guard.attach(page);

    await page.addInitScript(() => {
      const rocketWindow = window as RocketTestWindow;
      rocketWindow.__rocketOpened = [];
      window.open = ((url?: string | URL) => {
        if (url) rocketWindow.__rocketOpened?.push(String(url));
        return window;
      }) as typeof window.open;
    });

    await page.goto(outboundPage.route);
    await expect(page.getByRole("heading", { name: outboundPage.label })).toBeVisible();

    const listingRows = page.locator(outboundPage.listingSelector);
    const listingCount = await listingRows.count();
    expect(listingCount).toBeGreaterThan(0);

    const outboundLinks = page.locator("a[href^='http://'], a[href^='https://']");
    const outboundCount = await outboundLinks.count();
    expect(outboundCount).toBeGreaterThanOrEqual(listingCount);

    let listingIndex = 0;
    for (let index = 0; index < outboundCount; index++) {
      const link = outboundLinks.nth(index);
      await link.scrollIntoViewIfNeeded();
      const href = await link.getAttribute("href");
      const className = await link.getAttribute("class");
      const box = await link.boundingBox();
      expect(href).toBeTruthy();
      expect(box).not.toBeNull();
      const expectedHref = new URL(href!, page.url()).href;
      const isListingRow = className?.split(/\s+/).includes(outboundPage.listingSelector.slice(1)) ?? false;
      const horizontalFraction = isListingRow
        ? 0.08 + (listingIndex++ / Math.max(listingCount - 1, 1)) * 0.84
        : 0.5;
      const clickX = box!.x + box!.width * horizontalFraction;
      const clickY = box!.y + box!.height * 0.5;

      await page.mouse.move(clickX, clickY);
      await startRocketLaunchProbe(page, 230);
      await page.mouse.click(clickX, clickY);
      await page.waitForTimeout(90);
      await expectRocketBecameVisible(page);
      await expectRocketReachedBalancedScale(page);

      await expect.poll(() => page.evaluate(() => {
        const rocketWindow = window as RocketTestWindow;
        return rocketWindow.__rocketOpened?.length ?? 0;
      })).toBe(index + 1);
      await expect.poll(() => page.evaluate(() => {
        const rocketWindow = window as RocketTestWindow;
        return rocketWindow.__rocketOpened?.at(-1) ?? null;
      })).toBe(expectedHref);
      await expect(page).toHaveURL(outboundPage.route);
    }

    expect(listingIndex).toBe(listingCount);
    await expectNoHorizontalOverflow(page);
    guard.expectClean();
  });
}

test("cursor wakes when the viewport crosses into desktop mode", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop capability switching is covered by the desktop project.");

  const guard = consoleGuard();
  guard.attach(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects");
  await expect(page.locator("body")).not.toHaveClass(/rocket-cursor-active/);

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator("body")).toHaveClass(/rocket-cursor-active/);

  const firstProject = page.locator(".project-row").nth(0);
  const box = await firstProject.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
  await expect.poll(() => page.getByTestId("rocket-ship").evaluate((rocket) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(rocket).transform);
    return Math.hypot(matrix.a, matrix.b);
  })).toBeGreaterThan(1.15);

  guard.expectClean();
});

test("projects page does not overflow on small phone or tablet widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Viewport matrix only needs one browser project.");

  const guard = consoleGuard();
  guard.attach(page);

  for (const viewport of [
    { width: 360, height: 740 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  guard.expectClean();
});
