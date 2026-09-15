import { expect, test, type Page } from "@playwright/test";

async function scrollScreens(page: Page, screens: number) {
  await page.evaluate((distance) => {
    window.scrollTo({ top: window.innerHeight * distance, behavior: "instant" });
  }, screens);
}

async function expectScene(page: Page, id: string) {
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", id);
  await expect(page.locator(`#${id}`)).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("[data-island-scene]:not([inert])")).toHaveCount(1);
  await expect(page.getByRole("button", { name: `Show ${id} island`, exact: false })).toHaveAttribute("aria-current", "step");
}

async function expectFrameFits(page: Page) {
  const bounds = await page.locator("[data-island-stage]").boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.y).toBeCloseTo(0, 0);
  expect(bounds!.height).toBeCloseTo(viewport.height, 0);
  expect(bounds!.width).toBeCloseTo(viewport.width, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("navigation", { name: "Island scenes" })).toBeInViewport();
  await expect(page.locator('[data-island-scene][data-active="true"] [data-scene-copy]')).toBeInViewport({ ratio: 1 });
}

test("scroll advances and reverses three islands inside one viewport", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/2.0");
  await expect(page).toHaveTitle("Carter Wang");
  await expect(page.getByRole("heading", { name: "Carter Wang" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  await expect(page.locator("[data-island-scene]")).toHaveCount(3);

  for (const [screens, id] of [[0, "work"], [1.4, "writing"], [3, "projects"], [1.4, "writing"], [0, "work"]] as const) {
    await scrollScreens(page, screens);
    await expectScene(page, id);
    await expectFrameFits(page);
    await expect(page.locator(`#${id} img`)).toBeInViewport();
    expect(await page.locator(`#${id} img`).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("shooting star follows the full page proportionally in both directions", async ({ page }) => {
  await page.goto("/2.0");
  const comet = page.locator("[data-scene-comet]");

  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const progress of [0, 0.25, 0.5, 0.75, 0.9, 1, 0.5, 0]) {
      await page.evaluate((fraction) => {
        window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * fraction, behavior: "instant" });
      }, progress);
      await expect.poll(() => comet.evaluate((star, fraction) => {
        const buttons = Array.from(document.querySelectorAll("[data-scene-button]"));
        const centers = buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left + rect.width / 2;
        });
        const expected = centers[0] + (centers[centers.length - 1] - centers[0]) * fraction;
        return Math.abs(star.getBoundingClientRect().left - expected);
      }, progress)).toBeLessThan(1);
    }

    for (const [world, progress] of [["Writing", 0.5], ["Projects", 1], ["Work", 0]] as const) {
      await page.getByRole("button", { name: `Show ${world} island` }).click();
      await expect.poll(() => page.evaluate(() => scrollY / (document.documentElement.scrollHeight - innerHeight))).toBeCloseTo(progress, 3);
      await expectScene(page, world.toLowerCase());
    }
  }
});

test("scene controls, keyboard focus, and destination links work", async ({ page }) => {
  await page.goto("/2.0");
  await page.getByRole("button", { name: "Show Writing island" }).focus();
  await page.keyboard.press("Enter");
  await expectScene(page, "writing");
  await expect(page.getByRole("link", { name: "Enter Writing island" })).toBeVisible();
  await page.getByRole("button", { name: "Show Projects island" }).click();
  await expectScene(page, "projects");
  await page.getByRole("button", { name: "Back to the Work island" }).click();
  await expectScene(page, "work");
  await page.getByRole("button", { name: "Scroll to the Writing island" }).click();
  await expectScene(page, "writing");
  await page.getByRole("link", { name: "Enter Writing island" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-entering", "writing");
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  await expect(page).toHaveURL(/\/writing$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Writing", exact: true })).toBeVisible();
});

test("each island zooms into its own page and owns navigation until arrival", async ({ page }) => {
  for (const world of ["Work", "Writing", "Projects"]) {
    const id = world.toLowerCase();
    await page.goto(`/2.0#${id}`);
    await expectScene(page, id);
    await expect(page.getByRole("link", { name: /^Explore / })).toHaveCount(0);
    const island = page.getByRole("link", { name: `Enter ${world} island` });
    await island.click();
    await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-entering", id);
    await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
    await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
    await expect.poll(() => island.locator("[data-island-visual]").evaluate((visual) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(visual).transform);
      return Math.hypot(matrix.a, matrix.b);
    })).toBeGreaterThan(1.2);
    // Repeated island activation cannot restart the entry transition.
    await island.dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`/${id}$`));
    await expect(page.locator("[data-island-stage]")).toHaveCount(0);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: world, exact: true })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => scrollY)).toBeLessThan(2);
  }
});

test("reduced motion enters an island without zooming", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0#projects");
  await expectScene(page, "projects");
  await page.getByRole("link", { name: "Enter Projects island" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator("main h1")).toHaveText("Projects");
});

test("islands travel through the scene as solid objects and scrolling reverses the flight", async ({ page }) => {
  await page.goto("/2.0");
  const work = page.locator("#work [data-scene-art]");
  await expect(work).toBeVisible();
  const start = await work.boundingBox();
  await scrollScreens(page, 0.74);
  await expectScene(page, "writing");
  await expect(page.locator("#work")).toHaveCSS("opacity", "1");
  await expect(page.locator("#writing")).toHaveCSS("opacity", "1");
  await expect.poll(async () => {
    const rect = await work.boundingBox();
    return rect!.x + rect!.width / 2;
  }).toBeLessThan(start!.x + start!.width / 2 - page.viewportSize()!.width * 0.4);
  await expect.poll(() => page.locator("[data-flight-stars]").evaluate((stars) => Number(getComputedStyle(stars).opacity))).toBeGreaterThan(0.4);

  await scrollScreens(page, 0);
  await expectScene(page, "work");
  await expect.poll(async () => (await work.boundingBox())!.x).toBeCloseTo(start!.x, 0);
  await expect(page.locator("[data-flight-stars]")).toHaveCSS("opacity", "0");
});

test("reduced motion replaces camera travel with still cuts and updates live", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0");
  await scrollScreens(page, 0.74);
  await expectScene(page, "writing");
  await expect(page.locator("#writing")).toHaveCSS("opacity", "1");
  await expect(page.locator("#writing [data-scene-art]")).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("#writing")).toHaveCSS("opacity", "1");
  await expect(page.locator("#work")).toHaveCSS("opacity", "1");
  await expect(page.locator("#writing [data-scene-art]")).not.toHaveCSS("transform", "none");
  await expect(page.locator("[data-flight-stars]")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#writing")).toHaveCSS("opacity", "1");
  await expect(page.locator("#work")).toHaveCSS("opacity", "0");
  await expect(page.locator("[data-flight-stars]")).toBeHidden();
});

test("resize preserves the current island and compact viewports stay usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "A single browser covers the responsive size matrix.");
  await page.goto("/2.0#writing");
  await expectScene(page, "writing");
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await expectScene(page, "writing");
    await expectFrameFits(page);
    await page.getByRole("button", { name: "Show Work island" }).click();
    await expectScene(page, "work");
    await expectFrameFits(page);
    await page.getByRole("button", { name: "Show Writing island" }).click();
    await expectScene(page, "writing");
  }
});
