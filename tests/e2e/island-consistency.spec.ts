import { expect, test } from "@playwright/test";

test("island artwork stays consistent from overview through forward and reverse travel", async ({ page }) => {
  await page.goto("/2.0");
  const worlds = ["work", "writing", "projects"] as const;
  const sources = new Map<string, string>();
  for (const world of worlds) {
    const image = page.locator(`#intro [data-overview-island="${world}"] img`);
    const source = await image.evaluate((node: HTMLImageElement) => {
      const url = new URL(node.currentSrc || node.src);
      return url.searchParams.get("url") ?? url.pathname;
    });
    sources.set(world, source);
    const outro = page.locator(`#hello [data-overview-island="${world}"] img`);
    expect(await outro.evaluate((node: HTMLImageElement) => {
      const url = new URL(node.currentSrc || node.src);
      return url.searchParams.get("url") ?? url.pathname;
    })).toBe(source);
  }

  // Revisiting a world must preserve its geometry and media, and the depth
  // parallax that draws the still carries the same grade.
  for (const world of [...worlds, "writing", "work"] as const) {
    const name = world[0].toUpperCase() + world.slice(1);
    await page.getByRole("button", { name: `Show ${name} island` }).click();
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
    const visual = page.locator(`#${world} [data-island-visual]`);
    // Work also carries a daytime still; the night render is the default view.
    const still = visual.locator("img:not([data-city-time])");
    await expect(still).toHaveAttribute("src", sources.get(world)!);
    await expect.poll(() => still.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
    const overviewGrade = await page.locator(`#intro [data-overview-island="${world}"] img`).evaluate(node => getComputedStyle(node).filter);
    await expect(still).toHaveCSS("filter", overviewGrade);
    const parallax = visual.locator("canvas[data-parallax-still]");
    if (await parallax.count()) await expect(parallax).toHaveCSS("filter", overviewGrade);
  }
});
