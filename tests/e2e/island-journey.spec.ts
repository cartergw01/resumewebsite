import { expect, test, type Page } from "@playwright/test";

async function scrollScreens(page: Page, screens: number) {
  await page.evaluate((distance) => {
    window.scrollTo({ top: window.innerHeight * distance, behavior: "instant" });
  }, screens);
}

// Screens of scroll that land inside each stop's hold (496svh track, 4.5 units).
const stopScreens = (index: number) => index === 0 ? 0 : (index + 0.11) / 4.5 * 3.96;

async function expectScene(page: Page, id: string) {
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", id);
  await expect(page.locator(`#${id}`)).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("[data-island-scene]:not([inert])")).toHaveCount(1);
  if (id === "intro" || id === "hello") {
    await expect(page.locator("[data-scene-button][aria-current]")).toHaveCount(0);
  } else {
    await expect(page.getByRole("button", { name: `Show ${id} island`, exact: false })).toHaveAttribute("aria-current", "step");
  }
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
  await expect(page.locator("[data-island-scene]")).toHaveCount(5);

  const ids = ["intro", "work", "writing", "projects", "hello"];
  for (const id of ["intro", "work", "writing", "projects", "hello", "projects", "writing", "work", "intro"]) {
    await scrollScreens(page, stopScreens(ids.indexOf(id)));
    await expectScene(page, id);
    await expectFrameFits(page);
    const image = page.locator(`#${id} img`).first();
    await expect(image).toBeInViewport();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
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
        // The opening and closing views rest the star on the track's end points.
        const ends = Array.from(document.querySelectorAll("[data-track-end]")).map((end) => {
          const rect = end.getBoundingClientRect();
          return rect.left + rect.width / 2;
        });
        const stops = [ends[0], ...centers, ends[1]];
        const place = Math.min(fraction * 4.5, 4);
        const stop = Math.min(Math.floor(place), 3);
        const expected = stops[stop] + (stops[stop + 1] - stops[stop]) * (place - stop);
        return Math.abs(star.getBoundingClientRect().left - expected);
      }, progress)).toBeLessThan(1);
    }

    for (const [world, progress] of [["Writing", 2.11 / 4.5], ["Projects", 3.11 / 4.5], ["Work", 1.11 / 4.5]] as const) {
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
  await page.getByRole("button", { name: "Scroll to the end" }).click();
  await expectScene(page, "hello");
  await expect(page.locator("#hello").getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:cartergw01@gmail.com");
  await page.getByRole("button", { name: "Back to the start" }).click();
  await expectScene(page, "intro");
  await page.getByRole("button", { name: "Scroll to the Work island" }).click();
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
  await page.goto("/2.0#work");
  const work = page.locator("#work [data-scene-art]");
  await expect(work).toBeVisible();
  const start = await work.boundingBox();
  // Mid-flight between Work and Writing.
  await scrollScreens(page, 1.43);
  await expectScene(page, "writing");
  await expect(page.locator("#work")).toHaveCSS("opacity", "1");
  await expect(page.locator("#writing")).toHaveCSS("opacity", "1");
  await expect.poll(async () => {
    const rect = await work.boundingBox();
    return rect!.x + rect!.width / 2;
  }).toBeLessThan(start!.x + start!.width / 2 - page.viewportSize()!.width * 0.4);
  await expect.poll(() => page.locator("[data-flight-stars]").evaluate((stars) => Number(getComputedStyle(stars).opacity))).toBeGreaterThan(0.4);

  await scrollScreens(page, stopScreens(1));
  await expectScene(page, "work");
  await expect.poll(async () => (await work.boundingBox())!.x).toBeCloseTo(start!.x, 0);
  await expect(page.locator("[data-flight-stars]")).toHaveCSS("opacity", "0");
});

test("reduced motion replaces camera travel with still cuts and updates live", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0");
  // Mid-flight between Work and Writing.
  await scrollScreens(page, 1.43);
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

test("tapping the selected island tab opens its page", async ({ page }) => {
  await page.goto("/2.0#writing");
  await expectScene(page, "writing");
  const tab = page.getByRole("button", { name: "Show Writing island" });
  await expect(tab).toHaveAttribute("aria-label", /Activate again to open Writing/);
  await expect(page.getByRole("button", { name: "Show Projects island" })).toHaveAttribute("aria-label", "Show Projects island");
  await tab.click();
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-entering", "writing");
  await expect(page).toHaveURL(/\/writing$/, { timeout: 15_000 });
});

test("off-screen islands wait for the first sign of travel", async ({ page }, testInfo) => {
  // Full-size island files; the opening view uses small optimized previews.
  const requested: string[] = [];
  page.on("request", (request) => { if (/^\/(blender\/island-|_next\/static\/media\/taipei-flix)/.test(new URL(request.url()).pathname)) requested.push(request.url()); });
  await page.goto("/2.0");
  await expect.poll(() => page.locator("#intro img").first().evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(page.locator("#work [data-island-visual] img")).toHaveCount(0);
  expect(requested).toEqual([]);
  if (testInfo.project.name === "desktop") await page.mouse.wheel(0, 120);
  else await page.getByRole("button", { name: "Scroll to the Work island" }).tap();
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-warm", "true");
  await expect.poll(() => requested.length).toBeGreaterThanOrEqual(3);
  await expect(page.locator("#work [data-island-visual] img")).toHaveCount(1);
  await expect(page.locator("#writing [data-island-visual] img")).toHaveCount(1);
  await expect(page.locator("#projects [data-island-visual] img")).toHaveCount(1);
});

test("Escape backs out of an island approach and restores the page", async ({ page }) => {
  await page.goto("/2.0#work");
  await expectScene(page, "work");
  await page.getByRole("link", { name: "Enter Work island" }).click();
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-entering", "work");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/2\.0#work$/);
  await expectScene(page, "work");
});

test("skip link and the opening islands reach content directly", async ({ page }) => {
  await page.goto("/2.0");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  // The opening islands open their pages directly.
  await page.getByRole("navigation", { name: "Islands" }).getByRole("link", { name: "Enter Projects island" }).click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("each stop's heading enters its page like its island", async ({ page }) => {
  await page.goto("/2.0#writing");
  await expectScene(page, "writing");
  // The landing stays simple: no example lists under the headings.
  await expect(page.locator("#writing [data-scene-copy] ul")).toHaveCount(0);
  await page.getByRole("heading", { name: "Writing", exact: true }).getByRole("link").click();
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-entering", "writing");
  await expect(page.locator("body > [data-book-transition]")).toHaveCount(1);
  await expect(page).toHaveURL(/\/writing$/, { timeout: 15_000 });
});

test("a scroll gesture never rests between islands, and keys move one stop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Wheel and keyboard settling need a fine pointer.");
  await page.goto("/2.0");
  await page.mouse.move(640, 360);
  // A short flick carries the camera all the way to Work.
  await page.mouse.wheel(0, 90);
  await expectScene(page, "work");
  await expect.poll(() => page.evaluate(() => scrollY / (document.documentElement.scrollHeight - innerHeight)), { timeout: 5000 }).toBeCloseTo(1.11 / 4.5, 3);
  // A tiny nudge settles back where it was.
  await page.mouse.wheel(0, 12);
  await expect.poll(() => page.evaluate(() => scrollY / (document.documentElement.scrollHeight - innerHeight)), { timeout: 5000 }).toBeCloseTo(1.11 / 4.5, 3);
  await page.keyboard.press("ArrowDown");
  await expectScene(page, "writing");
  await page.keyboard.press("End");
  await expectScene(page, "hello");
  await page.keyboard.press("Home");
  await expectScene(page, "intro");
});
