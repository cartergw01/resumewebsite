import { expect, test, type Page } from "@playwright/test";

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

async function startRocketOpacityProbe(page: Page, durationMs = 260) {
  await page.evaluate((duration) => {
    const probeWindow = window as Window & { __rocketProbeMax?: number };
    probeWindow.__rocketProbeMax = 0;
    const until = performance.now() + duration;

    const tick = () => {
      const rocket = document.querySelector<HTMLElement>("[data-testid='rocket-ship']");
      const opacity = rocket ? Number.parseFloat(getComputedStyle(rocket).opacity) || 0 : 0;
      probeWindow.__rocketProbeMax = Math.max(probeWindow.__rocketProbeMax ?? 0, opacity);

      if (performance.now() < until) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, durationMs);
}

async function expectRocketBecameVisible(page: Page) {
  const maxOpacity = await page.evaluate(() => {
    const probeWindow = window as Window & { __rocketProbeMax?: number };
    return probeWindow.__rocketProbeMax ?? 0;
  });

  expect(maxOpacity).toBeGreaterThan(0.5);
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

  await startRocketOpacityProbe(page);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.waitForTimeout(70);

  await expect(page).toHaveURL("/");
  await expectRocketBecameVisible(page);

  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expect(page.getByLabel("Primary navigation").getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
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

  await startRocketOpacityProbe(page);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.waitForTimeout(90);

  await expectRocketBecameVisible(page);
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

  await startRocketOpacityProbe(page);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.waitForTimeout(90);

  await expectRocketBecameVisible(page);
  await expect(page).toHaveURL("/work", { timeout: 15_000 });
  await expectNoHorizontalOverflow(page);
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
