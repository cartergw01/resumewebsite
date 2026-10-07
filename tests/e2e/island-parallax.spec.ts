import { expect, test } from "@playwright/test";

test("islands draw their depth parallax and shift with the pointer", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop", "Parallax is for fine pointers only.");
  for (const world of ["work", "writing", "projects"]) {
    await page.goto(`/2.0#${world}`);
    const visual = page.locator(`#${world} [data-island-visual]`);
    await expect(visual).toHaveAttribute("data-parallax", "on", { timeout: 30_000 });
    // The still is now drawn by the canvas, and the images step aside.
    await expect(visual.locator("img").first()).toHaveCSS("opacity", "0");
    const shift = () => visual.evaluate((node: HTMLElement & { parallax?: { x: number; y: number } }) => node.parallax?.x ?? 0);
    await page.mouse.move(80, 80, { steps: 4 });
    await expect.poll(shift).toBeGreaterThan(.005);
    await page.mouse.move(1200, 720, { steps: 4 });
    await expect.poll(shift).toBeLessThan(-.005);
  }
});

test("touch devices keep the plain still", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "Phones and tablets only.");
  await page.goto("/2.0#work");
  await page.waitForTimeout(2500);
  await expect(page.locator("#work [data-island-visual]")).not.toHaveAttribute("data-parallax", "on");
});
