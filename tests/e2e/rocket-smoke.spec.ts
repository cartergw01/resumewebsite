import { expect, test, type Page } from "@playwright/test";

type RocketTestWindow = Window & {
  __rocketOpened?: string[];
  __rocketProbeMax?: number;
  __rocketProbeMaxScale?: number;
  __rocketReturnMaxScale?: number;
  __rocketReturnMinOpacity?: number;
  __rocketReturnSamples?: number;
  __rocketTransitionProbeAttached?: boolean;
  __rocketTransitions?: Array<{
    at: number;
    destinationReady: boolean;
    path: string;
    phase: string;
  }>;
};

const siteRoutes = ["/", "/work", "/writing", "/projects"] as const;

const outboundPages = [
  { label: "Writing", route: "/writing", listingSelector: ".archive-row" },
  { label: "Projects", route: "/projects", listingSelector: ".project-row" },
] as const;

function consoleGuard() {
  const errors: string[] = [];

  return {
    attach(page: Page) {
      page.on("console", (message) => {
        if (message.type() !== "error") return;

        const location = message.location().url;
        const isExpectedLocalAnalyticsMiss = location
          ? new URL(location).pathname === "/_vercel/insights/script.js"
            && ["127.0.0.1", "localhost"].includes(new URL(location).hostname)
          : false;

        // `next start` cannot serve Vercel's injected production analytics
        // endpoint locally. Keep the guard strict everywhere else so a missing
        // application asset still fails the suite.
        if (!isExpectedLocalAnalyticsMiss) errors.push(message.text());
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

async function expectCanvasBackedToRenderedSize(page: Page, testId: string) {
  const dimensions = await page.getByTestId(testId).evaluate((canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const usesFinePointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
    const dprCap = usesFinePointer ? 2 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    return {
      actualWidth: canvas.width,
      actualHeight: canvas.height,
      expectedWidth: Math.round(rect.width * dpr),
      expectedHeight: Math.round(rect.height * dpr),
    };
  });

  expect(dimensions.actualWidth, JSON.stringify(dimensions)).toBe(dimensions.expectedWidth);
  expect(dimensions.actualHeight, JSON.stringify(dimensions)).toBe(dimensions.expectedHeight);
}

async function expectRocketEffectsCleared(page: Page) {
  await page.waitForTimeout(70);
  const maxAlpha = await page.getByTestId("rocket-effects-canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return 0;

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let alpha = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      alpha = Math.max(alpha, pixels[index]);
      if (alpha === 255) break;
    }
    return alpha;
  });

  expect(maxAlpha).toBe(0);
}

async function startRocketLaunchProbe(page: Page, durationMs = 620) {
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

      const effectsCanvas = document.querySelector<HTMLCanvasElement>("[data-testid='rocket-effects-canvas']");
      const launchStillRendering = effectsCanvas?.dataset.animationState === "running"
        && (probeWindow.__rocketProbeMaxScale ?? 0) < 3.05;
      if (performance.now() < until || launchStillRendering) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, durationMs);
}

async function startTransitionProbe(page: Page) {
  await page.evaluate(() => {
    const probeWindow = window as RocketTestWindow;
    probeWindow.__rocketTransitions = [];
    if (probeWindow.__rocketTransitionProbeAttached) return;

    probeWindow.__rocketTransitionProbeAttached = true;
    document.addEventListener("rocket-transition-change", (event) => {
      const detail = (event as CustomEvent<{ at: number; phase: string }>).detail;
      probeWindow.__rocketTransitions?.push({
        at: detail.at,
        destinationReady: Boolean(document.querySelector("main h1")),
        path: window.location.pathname,
        phase: detail.phase,
      });
    });
  });
}

async function expectReadableLaunch(
  page: Page,
  { maxMs, minMs }: { maxMs: number; minMs: number },
) {
  await expect.poll(() => page.evaluate(() => {
    const events = (window as RocketTestWindow).__rocketTransitions ?? [];
    const launchIndex = events.findIndex((event) => event.phase === "launching");
    return launchIndex >= 0 && events.slice(launchIndex + 1).some((event) => event.phase !== "launching");
  })).toBe(true);

  const duration = await page.evaluate(() => {
    const events = (window as RocketTestWindow).__rocketTransitions ?? [];
    const launchIndex = events.findIndex((event) => event.phase === "launching");
    const completion = events.slice(launchIndex + 1).find((event) => event.phase !== "launching");
    return completion!.at - events[launchIndex].at;
  });

  expect(duration).toBeGreaterThanOrEqual(minMs);
  expect(duration).toBeLessThanOrEqual(maxMs);
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

async function startRocketReturnProbe(
  page: Page,
  origin: { x: number; y: number },
  expectedPath: string,
  durationMs = 1_400,
) {
  await page.evaluate(({ duration, path, point }) => {
    const probeWindow = window as RocketTestWindow;
    probeWindow.__rocketReturnMaxScale = 0;
    probeWindow.__rocketReturnMinOpacity = 1;
    probeWindow.__rocketReturnSamples = 0;
    const startedAt = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const rocket = document.querySelector<HTMLElement>("[data-testid='rocket-ship']");
      const position = document.querySelector<HTMLElement>("[data-testid='rocket-cursor']");

      if (elapsed >= 280 && window.location.pathname === path && rocket && position) {
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
  }, { duration: durationMs, path: expectedPath, point: origin });
}

async function expectRocketReturnIsFluid(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const probeWindow = window as RocketTestWindow;
    return probeWindow.__rocketReturnSamples ?? 0;
  })).toBeGreaterThan(2);

  const metrics = await page.evaluate(() => {
    const probeWindow = window as RocketTestWindow;
    return {
      maxScale: probeWindow.__rocketReturnMaxScale ?? 0,
      minOpacity: probeWindow.__rocketReturnMinOpacity ?? 1,
      samples: probeWindow.__rocketReturnSamples ?? 0,
    };
  });

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

  await expectCanvasBackedToRenderedSize(page, "rocket-effects-canvas");
  await expect(page.getByTestId("rocket-effects-canvas")).toHaveAttribute("data-animation-state", "idle");

  const workLink = page.getByLabel("Primary navigation").getByRole("link", { name: "Work" });
  const box = await workLink.boundingBox();
  expect(box).not.toBeNull();

  const clickPoint = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  await startTransitionProbe(page);
  await startRocketLaunchProbe(page);
  await startRocketReturnProbe(page, clickPoint, "/work");
  await page.mouse.click(clickPoint.x, clickPoint.y);
  await page.waitForTimeout(300);

  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  await expectRocketBecameVisible(page);
  await expectRocketReachedBalancedScale(page);
  await expectReadableLaunch(page, { minMs: 480, maxMs: 900 });

  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expect(page.getByLabel("Primary navigation").getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
  const invalidArrival = await page.evaluate(() => {
    const events = (window as RocketTestWindow).__rocketTransitions ?? [];
    return events.find((event) => (
      event.phase === "arriving" &&
      (event.path !== "/work" || !event.destinationReady)
    ));
  });
  expect(invalidArrival).toBeUndefined();
  await expectRocketReturnIsFluid(page);
  await expectCanvasBackedToRenderedSize(page, "work-starfield");
  await expect(page.getByTestId("rocket-effects-canvas")).toHaveAttribute("data-animation-state", "idle", { timeout: 5_000 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expectNoHorizontalOverflow(page);
  guard.expectClean();
});

test("desktop cursor follows the newest pointer sample synchronously on every route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop cursor mode is covered by the desktop project.");

  const guard = consoleGuard();
  guard.attach(page);

  for (const route of siteRoutes) {
    await page.goto(route);
    await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
    await expect(page.locator("body")).toHaveClass(/rocket-cursor-active/);

    for (const point of [
      { x: 91, y: 113 },
      { x: 1187, y: 647 },
      { x: 641, y: 359 },
    ]) {
      const position = await page.evaluate((target) => {
        document.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          clientX: target.x,
          clientY: target.y,
          isPrimary: true,
          pointerId: 1,
          pointerType: "mouse",
        }));
        const cursor = document.querySelector<HTMLElement>("[data-testid='rocket-cursor']");
        const matrix = new DOMMatrixReadOnly(getComputedStyle(cursor!).transform);
        return { x: matrix.m41, y: matrix.m42 };
      }, point);

      expect(Math.abs(position.x - point.x), `${route} x-position`).toBeLessThanOrEqual(1);
      expect(Math.abs(position.y - point.y), `${route} y-position`).toBeLessThanOrEqual(1);
    }

    await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
  }

  guard.expectClean();
});

test("rapid repeat navigation cannot bypass or replace the active launch", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop navigation locking is covered by the desktop project.");

  const guard = consoleGuard();
  guard.attach(page);
  await page.goto("/");
  await startTransitionProbe(page);

  const nav = page.getByLabel("Primary navigation");
  const workBox = await nav.getByRole("link", { name: "Work" }).boundingBox();
  const projectsBox = await nav.getByRole("link", { name: "Projects" }).boundingBox();
  expect(workBox).not.toBeNull();
  expect(projectsBox).not.toBeNull();

  await page.mouse.click(workBox!.x + workBox!.width / 2, workBox!.y + workBox!.height / 2);
  await page.waitForTimeout(45);
  await page.mouse.click(
    projectsBox!.x + projectsBox!.width / 2,
    projectsBox!.y + projectsBox!.height / 2,
  );
  await page.waitForTimeout(260);

  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  await expectReadableLaunch(page, { minMs: 480, maxMs: 900 });
  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expect(page).not.toHaveURL("/projects");

  const launchCount = await page.evaluate(() => (
    ((window as RocketTestWindow).__rocketTransitions ?? [])
      .filter((event) => event.phase === "launching")
      .length
  ));
  expect(launchCount).toBe(1);
  guard.expectClean();
});

test("a blocked main thread resumes the launch instead of stranding navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Launch recovery is covered by the desktop project.");

  const guard = consoleGuard();
  guard.attach(page);
  await page.goto("/");
  await startTransitionProbe(page);

  const workLink = page.getByLabel("Primary navigation").getByRole("link", { name: "Work" });
  const box = await workLink.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  // Simulate a long render/compile hitch spanning the nominal timeline. The
  // frame-owned state machine must paint its final launch frame after recovery,
  // then navigate exactly once rather than waiting on a lost timeout handshake.
  await page.evaluate(() => {
    const blockedUntil = performance.now() + 650;
    while (performance.now() < blockedUntil) {
      // Intentional main-thread stall for the regression scenario.
    }
  });

  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expect(page.getByTestId("rocket-cursor")).not.toHaveAttribute("data-transition-phase", "launching");
  const launchCount = await page.evaluate(() => (
    ((window as RocketTestWindow).__rocketTransitions ?? [])
      .filter((event) => event.phase === "launching")
      .length
  ));
  expect(launchCount).toBe(1);
  guard.expectClean();
});

test("desktop launch behavior is shared across every internal route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop route matrix is covered by the desktop project.");

  const guard = consoleGuard();
  guard.attach(page);

  for (const transition of [
    { from: "/work", link: "Writing", to: "/writing" },
    { from: "/writing", link: "Projects", to: "/projects" },
    { from: "/projects", link: "Home", to: "/" },
  ]) {
    await page.goto(transition.from);
    const link = page.getByLabel("Primary navigation").getByRole("link", { name: transition.link });
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
    await page.waitForTimeout(220);
    await expect(page).toHaveURL(transition.from);
    await expect(page).toHaveURL(transition.to, { timeout: 15_000 });
    await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle", {
      timeout: 5_000,
    });
  }

  guard.expectClean();
});

test("mobile tap mode launches without a persistent cursor", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile tap mode is covered by mobile projects.");

  const guard = consoleGuard();
  guard.attach(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Carter Wang" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/rocket-cursor-active/);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "0");

  const workLink = page.getByLabel("Primary navigation").getByRole("link", { name: "Work" });

  await startTransitionProbe(page);
  await startRocketLaunchProbe(page);
  await workLink.tap();
  await page.waitForTimeout(260);

  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  await expectRocketBecameVisible(page);
  await expectRocketReachedBalancedScale(page);
  await expectReadableLaunch(page, { minMs: 420, maxMs: 850 });
  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expect(page.getByLabel("Primary navigation").getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
  await expectRocketEffectsCleared(page);
  await expectCanvasBackedToRenderedSize(page, "rocket-effects-canvas");
  await expectCanvasBackedToRenderedSize(page, "work-starfield");
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "0");
  await expectNoHorizontalOverflow(page);
  guard.expectClean();
});

test("mobile repeat taps cannot bypass the active launch", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile navigation locking is covered by mobile projects.");

  const guard = consoleGuard();
  guard.attach(page);
  await page.goto("/");

  const nav = page.getByLabel("Primary navigation");
  await nav.getByRole("link", { name: "Work" }).tap();
  await page.waitForTimeout(45);
  await nav.getByRole("link", { name: "Projects" }).tap();
  await page.waitForTimeout(220);

  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expect(page).not.toHaveURL("/projects");
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "0");
  guard.expectClean();
});

test("mobile world orb first tap launches to its route", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile orb hit target is covered by mobile projects.");

  const guard = consoleGuard();
  guard.attach(page);

  await page.goto("/#constellation");
  await expect(page.locator(".world-card.world-work .world-orb-link")).toBeVisible();

  const orb = page.locator(".world-card.world-work .world-orb-link");
  // The document uses smooth anchor scrolling. Wait for the fragment trip to
  // settle before capturing touch coordinates so the target cannot slide out
  // from under a real touchscreen tap between `boundingBox` and `tap`.
  await expect.poll(() => page.evaluate(() => window.scrollY), {
    timeout: 3_000,
    intervals: [100, 100, 150, 200],
  }).toBeGreaterThan(200);

  await startRocketLaunchProbe(page);
  await orb.tap();
  await page.waitForTimeout(140);

  await expectRocketBecameVisible(page);
  await expectRocketReachedBalancedScale(page);
  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expectRocketEffectsCleared(page);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "0");
  await expectNoHorizontalOverflow(page);
  guard.expectClean();
});

test("reduced motion skips launch and responds to preference changes after mount", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Reduced-motion behavior only needs one browser project.");

  const guard = consoleGuard();
  guard.attach(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("body")).not.toHaveClass(/rocket-cursor-active/);
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "0");
  await expect(page.getByTestId("rocket-effects-canvas")).toHaveAttribute("data-animation-state", "idle");

  await page.getByLabel("Primary navigation").getByRole("link", { name: "Work" }).click();
  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
  await expectRocketEffectsCleared(page);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("body")).toHaveClass(/rocket-cursor-active/);
  await page.mouse.move(640, 360);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("body")).not.toHaveClass(/rocket-cursor-active/);
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "0");
  await page.getByLabel("Primary navigation").getByRole("link", { name: "Writing" }).click();
  await expect(page).toHaveURL("/writing", { timeout: 15_000 });
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
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
      // Keep sampling through the full ignition + accelerating takeoff.
      await startRocketLaunchProbe(page, 620);
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

test("new-tab links launch once and preserve the source page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "New-tab semantics are covered by the desktop project.");

  const guard = consoleGuard();
  guard.attach(page);
  await page.goto("/");
  const socialLink = page.getByLabel("Social links").getByRole("link", { name: "X" });
  await socialLink.evaluate((link: HTMLAnchorElement) => {
    link.href = "/work";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  const popupPromise = page.waitForEvent("popup");
  await socialLink.click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");

  await expect(page).toHaveURL("/");
  await expect(popup).toHaveURL("/work");
  await popup.close();
  guard.expectClean();
});

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

test("content pages do not overflow on small phone or tablet widths", async ({ page }, testInfo) => {
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

    await page.goto("/writing");
    await expect(page.getByRole("heading", { name: "Writing" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  guard.expectClean();
});
