import { expect, test, type Page } from "@playwright/test";

const shot = (page: Page) => page.locator("canvas[data-hoop-shot]");

async function tapBall(page: Page) {
  const ball = page.locator('[data-curio="basketball"]');
  await expect(ball).toBeVisible();
  const marker = (await ball.locator(":scope > span").boundingBox())!;
  if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches)) await page.touchscreen.tap(marker.x, marker.y);
  else await page.mouse.click(marker.x, marker.y);
}

// Whether anything is left drawn on the shot's canvas.
const painted = (page: Page) => shot(page).evaluate((canvas: HTMLCanvasElement) => {
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) if (data[i]) return true;
  return false;
});

test("tapping the ball shoots it through the net and hands back to the still", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#projects");
  await tapBall(page);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "flying", { timeout: 15_000 });
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
  expect(await painted(page)).toBe(true);
  // A second tap in flight doesn't restart it.
  await tapBall(page);
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
  // The still's net is cut away only while the live one moves.
  await expect(page.locator("[data-island-visual][data-net-cut]")).toHaveCount(1, { timeout: 30_000 });
  const mask = await page.locator("[data-island-visual][data-net-cut] img").first().evaluate(image => getComputedStyle(image).maskImage);
  expect(mask).toContain("gradient");
  await expect(page.locator("[data-island-visual][data-net-cut]")).toHaveCount(0, { timeout: 30_000 });
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle", { timeout: 30_000 });
  expect(await painted(page)).toBe(false);
  expect(errors).toEqual([]);
  // And again.
  await tapBall(page);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "flying");
});

test("leaving the island mid-shot puts everything back", async ({ page }) => {
  await page.goto("/#projects");
  await tapBall(page);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "flying", { timeout: 15_000 });
  await page.locator("[data-island-stage]").evaluate(stage => { (stage as HTMLElement).dataset.travelling = "true"; });
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle");
  await expect(page.locator("[data-island-visual][data-net-cut]")).toHaveCount(0);
  expect(await painted(page)).toBe(false);
});

test("reduced motion picks the ball up instead", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#projects");
  await tapBall(page);
  await expect(page.locator("dialog[data-discovery]")).toHaveAttribute("data-discovery", "basketball");
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle");
});

test("if its layers can't load, the ball is picked up instead", async ({ page }) => {
  await page.route("**/blender/hoop-shot-*.webp", route => route.abort());
  await page.goto("/#projects");
  await tapBall(page);
  await expect(page.locator("dialog[data-discovery]")).toHaveAttribute("data-discovery", "basketball", { timeout: 15_000 });
});
