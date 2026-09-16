import { expect, test } from "@playwright/test";

test("city and workshop details animate only while active and respect the shared pause control and reduced motion", async ({ page }) => {
  await page.goto("/2.0");
  await expect(page.getByRole("button", { name: /island animation/ })).toHaveCount(0);
  for (const world of ["work", "projects"] as const) {
    const title = world === "work" ? "Work" : "Projects";
    await page.getByRole("button", { name: `Show ${title} island` }).click();
    const visual = page.locator(`[data-living-island=${world}]`);
    await expect(visual).toHaveAttribute("data-motion-running", "true");
    const detail = visual.locator("svg > g").first();
    const initial = await detail.evaluate((node) => getComputedStyle(node).opacity);
    await expect.poll(() => detail.evaluate((node) => getComputedStyle(node).opacity)).not.toBe(initial);
    await page.getByRole("button", { name: "Pause background video" }).click();
    await expect(visual).toHaveAttribute("data-motion-running", "false");
    await expect(detail).toHaveCSS("animation-play-state", "paused");
    await page.getByRole("button", { name: "Show Writing island" }).click();
    await page.getByRole("button", { name: `Show ${title} island` }).click();
    await expect(visual).toHaveAttribute("data-motion-running", "false");
    await page.getByRole("button", { name: "Play background video" }).click();
    await expect(visual).toHaveAttribute("data-motion-running", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(visual).toHaveAttribute("data-motion-running", "false");
    await expect(visual.locator("svg")).toBeHidden();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(visual).toHaveAttribute("data-motion-running", "true");
    await page.getByRole("button", { name: "Show Writing island" }).click();
    await expect(visual).toHaveAttribute("data-motion-running", "false");
  }
});

test("each subpage returns to its island and Projects shares the video and workshop artwork", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const world of ["projects", "writing", "work"]) {
    await page.goto(`/${world}`);
    const back = page.getByRole("link", { name: "Back to islands" });
    await expect(back).toHaveAttribute("href", `/2.0#${world}`);
    if (world === "projects") {
      await expect(page.locator("[data-background-visual]")).toHaveAttribute("data-video-ready", "true");
      const video = page.locator("[data-background-video]");
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.1);
      const art = page.locator(".projects-hero img");
      await expect.poll(() => art.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
      await expect(art).toHaveAttribute("src", "/world-projects-workshop-v3.webp");
      await expect(page.getByRole("link", { name: "Open TaipeiFlix live project in a new tab" })).toHaveAttribute("href", "https://taipeiflix.com/");
    }
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/2\\.0#${world}$`));
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
    await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
    // Check after the rocket's arrival too; its delayed reset used to erase
    // the correct island position on a fast production route transition.
    await expect.poll(() => page.evaluate(() => scrollY / (document.documentElement.scrollHeight - innerHeight))).toBeCloseTo(world === "work" ? 0 : world === "writing" ? 0.5 : 1, 3);
    await expect(page.locator(`#${world} [data-island-link]`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("mobile copy, larger annotations, and island controls fit without overlap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser covers the additional compact size matrix.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/2.0");
    for (const title of ["Work", "Writing", "Projects"]) {
      await page.getByRole("button", { name: `Show ${title} island` }).click();
      const scene = page.locator(`#${title.toLowerCase()}`);
      const copy = await scene.locator("[data-scene-copy]").boundingBox();
      const art = await scene.locator("[data-scene-art]").boundingBox();
      if (viewport.width <= 760) {
        expect(art!.y - (copy!.y + copy!.height)).toBeGreaterThanOrEqual(0);
        expect(art!.y - (copy!.y + copy!.height)).toBeLessThan(24);
      }
      const cue = scene.locator("[data-island-link] > span:last-child");
      // Rotated annotations produce fractional IntersectionObserver rounding.
      await expect(cue).toBeInViewport({ ratio: 0.999 });
      const cueBounds = await cue.boundingBox();
      expect(cueBounds!.x).toBeGreaterThanOrEqual(-0.5);
      expect(cueBounds!.x + cueBounds!.width).toBeLessThanOrEqual(viewport.width + 0.5);
      const nav = await page.getByRole("navigation", { name: "Island scenes" }).boundingBox();
      expect(cueBounds!.y + cueBounds!.height).toBeLessThan(nav!.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
