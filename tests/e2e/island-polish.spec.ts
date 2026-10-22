import { expect, test } from "@playwright/test";
import { hydrated } from "./hydrated";

test("city and workshop details animate only while active and respect reduced motion", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /island animation/ })).toHaveCount(0);
  for (const world of ["work", "projects"] as const) {
    const title = world === "work" ? "Work" : "Projects";
    await (world === "work" ? page.locator("[data-next-scene]") : page.getByRole("button", { name: `Show ${title} island` })).click();
    const visual = page.locator(`[data-living-island=${world}]`);
    await expect(visual).toHaveAttribute("data-motion-running", "true");
    const ambient = visual.locator(world === "work" ? "[data-island-traffic]" : "[data-screen-light]").first();
    await expect(ambient).toHaveCSS("animation-play-state", "running");
    const detail = visual.locator("svg > g").first();
    const initial = await detail.evaluate((node) => getComputedStyle(node).opacity);
    await expect.poll(() => detail.evaluate((node) => getComputedStyle(node).opacity)).not.toBe(initial);
    await page.getByRole("button", { name: "Show Writing island" }).click();
    await expect(visual).toHaveAttribute("data-motion-running", "false");
    await expect(ambient).toHaveCSS("animation-play-state", "paused");
    await page.getByRole("button", { name: `Show ${title} island` }).click();
    await expect(visual).toHaveAttribute("data-motion-running", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(visual).toHaveAttribute("data-motion-running", "false");
    await expect(visual.locator("svg").first()).toBeHidden();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(visual).toHaveAttribute("data-motion-running", "true");
    await page.getByRole("button", { name: "Show Writing island" }).click();
    await expect(visual).toHaveAttribute("data-motion-running", "false");
  }
});

test("each island scene restores directly and Projects opens on the working screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const world of ["projects", "writing", "work"]) {
    await page.goto(`/${world}`);
    await hydrated(page);
    // Home leads back to the islands. Phones drop it,
    // since Back to islands already sits in the corner.
    const home = page.locator(".site-nav-home");
    await expect(home).toHaveAttribute("href", "/");
    if ((page.viewportSize()?.width ?? 1280) <= 760) await expect(home).toBeHidden();
    else await expect(home).toBeVisible();
    if (world === "projects") {
      await expect(page.locator("[data-background-visual]")).toHaveAttribute("data-video-ready", "true");
      const video = page.locator("[data-background-video]");
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.1);
      const art = page.locator("[data-project-screen] img");
      await expect.poll(() => art.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
      await expect(page.locator('img[src="/world-projects-workshop-v5.webp"]')).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Open TaipeiFlix live project in a new tab" })).toHaveAttribute("href", "https://taipeiflix.com/");
    }
    await page.goto(`/#${world}`);
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
    await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
    // Check after the rocket's arrival too; its delayed reset used to erase
    // the correct island position on a fast production route transition.
    await expect.poll(() => page.evaluate(() => scrollY / (document.documentElement.scrollHeight - innerHeight))).toBeCloseTo((["work", "writing", "projects"].indexOf(world) + 1.11) / 4.5, 3);
    await expect(page.locator(`#${world} [data-island-link]`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await hydrated(page);
  }
  expect(errors).toEqual([]);
});

test("mobile copy, heading links, and island controls fit without overlap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser covers the additional compact size matrix.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    for (const title of ["Work", "Writing", "Projects"]) {
      await (title === "Work" ? page.locator("[data-next-scene]") : page.getByRole("button", { name: `Show ${title} island` })).click();
      const scene = page.locator(`#${title.toLowerCase()}`);
      const copy = await scene.locator("[data-scene-copy]").boundingBox();
      const art = await scene.locator("[data-scene-art]").boundingBox();
      if (viewport.width <= 760) {
        expect(art!.y - (copy!.y + copy!.height)).toBeGreaterThanOrEqual(0);
        expect(art!.y - (copy!.y + copy!.height)).toBeLessThan(24);
      }
      const cue = scene.locator("h2 [data-enter-island]");
      await expect(cue).toBeInViewport({ ratio: 1 });
      const cueBounds = await cue.boundingBox();
      expect(cueBounds!.x).toBeGreaterThanOrEqual(-0.5);
      expect(cueBounds!.x + cueBounds!.width).toBeLessThanOrEqual(viewport.width + 0.5);
      const nav = await page.getByRole("navigation", { name: "Island scenes" }).boundingBox();
      expect(cueBounds!.y + cueBounds!.height).toBeLessThan(nav!.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("destination navigation stays readable on scroll and the matching island restores", async ({ page, isMobile }) => {
  for (const world of ["work", "writing", "projects"]) {
    await page.goto(`/${world}`);
    const nav = page.locator(".site-nav");
    await expect(page.locator(".site-nav-home")).toHaveAttribute("href", "/");
    await expect(nav).toHaveAttribute("data-scrolled", "false");
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
    await expect(nav).toHaveAttribute("data-scrolled", "true");
    if (isMobile) {
      // Phones tuck the bar away while you read down, and bring it straight
      // back as soon as you scroll up.
      await expect(nav).toHaveAttribute("data-tucked", "true");
      await expect(nav).not.toBeInViewport();
      await page.evaluate(() => window.scrollBy({ top: -60, behavior: "instant" }));
      await expect(nav).not.toHaveAttribute("data-tucked");
    }
    await expect(nav).toBeInViewport({ ratio: 1 });
    await expect(nav).toHaveCSS("position", "fixed");
    const backdrop = await nav.evaluate(node => getComputedStyle(node, "::before").backgroundImage);
    expect(backdrop).toContain("0.98");
    await page.goto(`/#${world}`);
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
    await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
    await expect.poll(() => page.evaluate(() => scrollY / (document.documentElement.scrollHeight - innerHeight))).toBeCloseTo((["work", "writing", "projects"].indexOf(world) + 1.11) / 4.5, 3);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  }
});


test("heading links enter their island pages and chapter navigation reveals after the intro", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("[data-scene-nav]")).toBeHidden();
  await expect(page.locator("[data-next-scene]")).toBeVisible();
  const initialCue = (await page.locator("[data-next-scene]").boundingBox())!;
  expect(initialCue.x + initialCue.width / 2).toBeCloseTo(await page.evaluate(() => document.documentElement.clientWidth / 2), 0);
  for (const world of ["Work", "Writing", "Projects"]) {
    const id = world.toLowerCase();
    await (world === "Work" ? page.locator("[data-next-scene]") : page.getByRole("button", { name: `Show ${world} island` })).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator("[data-scene-nav]")).toBeVisible();
    const island = page.locator(`#${id} [data-island-link]`);
    const cue = page.locator(`#${id} h2 [data-enter-island]`);
    await expect(cue).toBeInViewport({ ratio: 1 });
    const description = await page.locator(`#${id} [data-scene-copy] > p`).boundingBox();
    const heading = (await cue.boundingBox())!;
    expect(heading.y + heading.height).toBeLessThan(description!.y);
    if (testInfo.project.name === "desktop") {
      await island.hover();
      await expect(cue).toBeVisible();
      await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-engaged", "true");
      await page.mouse.move(4, 4);
      await cue.focus();
      await expect(cue).toBeFocused();
      await page.keyboard.press("Enter");
    } else {
      await cue.click();
    }
    // Allow the existing island entrance and a cold development route compile.
    await expect(page).toHaveURL(new RegExp(`/${id}$`), { timeout: 15_000 });
    await page.getByRole("link", { name: "Back to islands" }).click();
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", id);
  }
  await page.getByRole("button", { name: "Show Work island" }).focus();
  await page.keyboard.press("Home");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "intro");
  await expect(page.locator("[data-scene-nav]")).toBeHidden();
  await expect(page.locator("[data-next-scene]")).toBeVisible();
  await expect(page.locator("[data-next-scene]")).toBeFocused();
});
