import { expect, test, type Page } from "@playwright/test";

const transitions = { work: "work", writing: "book", projects: "workshop" } as const;
const overlays = "body > [data-work-transition], body > [data-book-transition], body > [data-workshop-transition]";

// Record the brief entry at creation, rather than racing its arrival animation.
async function recordEntries(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as Window & { overviewEntries?: string[] }).overviewEntries = seen;
    new MutationObserver(() => {
      for (const kind of ["work", "book", "workshop"]) {
        if (document.querySelector(`body > [data-${kind}-transition]`) && !seen.includes(kind)) seen.push(kind);
      }
    }).observe(document.body, { childList: true });
  });
}

for (const scene of ["intro", "hello"]) {
  for (const world of ["work", "writing", "projects"] as const) {
    test(`${scene} ${world} island carries its entrance into the destination`, async ({ page, isMobile }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(scene === "intro" ? "/2.0" : "/2.0#hello");
      await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", scene);
      const link = page.locator(`#${scene} [data-overview-island="${world}"]`);
      await expect.poll(() => link.locator("img").first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await recordEntries(page);
      if (world === "work") {
        // Both overview positions use the same real camera when it is ready.
        await link.focus();
        await expect(link.locator("[data-entry-camera]")).toHaveAttribute("data-orbit-ready", "true", { timeout: 60_000 });
      }
      if (isMobile) await link.tap(); else await link.click();
      await expect.poll(() => page.evaluate(() => (window as Window & { overviewEntries?: string[] }).overviewEntries)).toContain(transitions[world]);
      if (world === "work") await expect(page.locator("body > [data-work-transition]")).toHaveAttribute("data-work-camera", "3d");
      await expect(page).toHaveURL(new RegExp(`/${world}$`));
      await expect(page.locator(overlays)).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1, exact: true, name: world[0].toUpperCase() + world.slice(1) })).toBeVisible();
      if (world === "writing") await expect(page.locator(".archive-row")).toHaveCount(11);
      if (world === "projects") await expect(page.locator("[data-project-shot]")).toHaveCount(8);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goBack();
      await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
      await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
      expect(errors).toEqual([]);
    });
  }
}

test("landing text links enter their corresponding islands", async ({ page }) => {
  for (const world of ["writing", "projects"] as const) {
    await page.goto("/2.0");
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "intro");
    await recordEntries(page);
    await page.locator(`#intro [data-scene-copy] a[href="/${world}"]`).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => (window as Window & { overviewEntries?: string[] }).overviewEntries)).toEqual([transitions[world]]);
    await expect(page).toHaveURL(new RegExp(`/${world}$`));
    await expect(page.locator(overlays)).toHaveCount(0);
  }
});

test("an immediate Work entry needs no 3D download and Escape restores the overview", async ({ page }) => {
  await page.route("**/orbit-*.glb", route => route.abort());
  for (const scene of ["intro", "hello"]) {
    await page.goto(scene === "intro" ? "/2.0" : "/2.0#hello");
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", scene);
    const link = page.locator(`#${scene} [data-overview-island="work"]`);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("body > [data-work-transition]")).toHaveAttribute("data-work-camera", "still");
    await page.keyboard.press("Escape");
    await expect(page.locator(overlays)).toHaveCount(0);
    await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
    await expect(page).toHaveURL(scene === "intro" ? /\/2\.0$/ : /#hello$/);
    await expect(link).not.toHaveAttribute("data-entering");
    await expect(page.locator(`#${scene} [data-overview-island="writing"]`)).toBeVisible();
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.locator(overlays)).toHaveCount(0);
  }
});

test("reduced-motion overview links remain direct and complete", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [scene, world] of [["intro", "work"], ["hello", "writing"], ["intro", "projects"]]) {
    await page.goto(scene === "intro" ? "/2.0" : "/2.0#hello");
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", scene);
    const link = page.locator(`#${scene} [data-overview-island="${world}"]`);
    await expect(link).toBeVisible();
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${world}$`));
    await expect(page.locator(overlays)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, exact: true, name: world[0].toUpperCase() + world.slice(1) })).toBeVisible();
  }
});
