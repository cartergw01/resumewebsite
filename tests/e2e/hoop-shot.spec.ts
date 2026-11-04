import { expect, test, type Page } from "@playwright/test";
import { chooseLanding, distanceFromRim, planShot, REST, type Ball } from "../../lib/hoop-shot";
import data from "../../lib/hoop-shot.json" with { type: "json" };

const shot = (page: Page) => page.locator("canvas[data-hoop-shot]");
const ball = (page: Page) => page.locator('[data-curio="basketball"]');

async function tapBall(page: Page) {
  await expect(ball(page)).toBeVisible();
  const marker = (await ball(page).locator(":scope > span").boundingBox())!;
  if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches)) await page.touchscreen.tap(marker.x, marker.y);
  else await page.mouse.click(marker.x, marker.y);
  return marker;
}

// Whether anything is drawn on the shot's canvas.
const painted = (page: Page) => shot(page).evaluate((canvas: HTMLCanvasElement) => {
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) if (data[i]) return true;
  return false;
});
const picture = (page: Page) => shot(page).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());

test("from anywhere on the court it drops through the rim and comes to rest on the boards", ({}, info) => {
  test.skip(info.project.name !== "desktop", "Pure arithmetic: one browser project is enough.");
  const [rimX, rimY, rimZ] = data.world.rim;
  const R = data.world.ballRadius, floor = data.world.floor;
  let seed = 7;
  const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  let from: Ball = REST;
  const spots = new Set<string>();
  const problems: string[] = [];
  const check = (ok: boolean, what: string, n: number) => { if (!ok) problems.push(`shot ${n}: ${what}`); };
  for (let n = 0; n < 200; n++) {
    const landing = chooseLanding(from, random);
    check(distanceFromRim(landing) >= .99, "lands under the hoop", n);
    const plan = planShot(from, landing);
    // Dead centre through the rim, heading down, whatever the start.
    const at = plan.pose(plan.throughRim - 1e-6);
    check(Math.hypot(at.x - rimX, at.y - rimY) < .001, "misses the rim's centre", n);
    check(Math.abs(at.z - rimZ) < .001, "not at the rim's height", n);
    check(plan.pose(plan.throughRim).z <= at.z, "not heading down", n);
    for (let t = 0; t < plan.duration; t += 1 / 120) {
      const pose = plan.pose(t);
      check(pose.z >= floor + R - .001, "goes through the floor", n);
      // On the way up it never passes through the hoop from below.
      if (t < plan.throughRim && pose.z > rimZ - R && pose.z < rimZ + R && pose.z > plan.pose(t - .001).z) {
        check(Math.hypot(pose.x - rimX, pose.y - rimY) > .28 + R * .6, "rises through the rim", n);
      }
    }
    // It ends where it was going, at rest, on one of its rendered frames.
    const end = plan.pose(plan.duration + .001);
    check(Math.hypot(end.x - landing.x, end.y - landing.y) < .001, "stops short of its landing", n);
    check(Math.abs(end.z - (floor + R)) < 1e-5, "not on the floor at the end", n);
    const frame = end.spin / (Math.PI * 2 / data.frames);
    check(Math.abs(frame - Math.round(frame)) < 1e-6, "stops between frames", n);
    // Snappy: in the hoop in about a second, all over in about three.
    check(plan.throughRim < 1.2 && plan.duration < 3.5, "too slow", n);
    spots.add(`${landing.x.toFixed(1)},${landing.y.toFixed(1)}`);
    from = plan.final;
  }
  expect(problems).toEqual([]);
  expect(spots.size).toBeGreaterThan(40);
});

test("it only moves when tapped, and can be shot again from where it lands", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#projects");
  await expect(ball(page)).toBeVisible();
  // Untouched, the still shows the ball and the canvas is empty.
  await page.waitForTimeout(800);
  expect(await painted(page)).toBe(false);

  const first = await tapBall(page);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "flying", { timeout: 15_000 });
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
  // The still's net is cut away only while the live one moves.
  await expect(page.locator("[data-island-visual][data-net-cut]")).toHaveCount(1, { timeout: 30_000 });
  const mask = await page.locator("[data-island-visual][data-net-cut] img").first().evaluate(image => getComputedStyle(image).maskImage);
  expect(mask).toContain("gradient");
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle", { timeout: 30_000 });
  await expect(page.locator("[data-island-visual][data-net-cut]")).toHaveCount(0, { timeout: 15_000 });

  // At rest, away from where it started, and it stays there.
  await expect.poll(() => painted(page)).toBe(true);
  const settled = await picture(page);
  const target = (await ball(page).locator(":scope > span").boundingBox())!;
  expect(Math.hypot(target.x - first.x, target.y - first.y)).toBeGreaterThan(10);
  await page.waitForTimeout(1500);
  expect(await picture(page)).toBe(settled);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle");

  // Its target went with it: another tap there is another shot.
  await tapBall(page);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "flying");
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle", { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("leaving the island mid-shot lands the ball and leaves nothing cut", async ({ page }) => {
  await page.goto("/#projects");
  await tapBall(page);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "flying", { timeout: 15_000 });
  await page.locator("[data-island-stage]").evaluate(stage => { (stage as HTMLElement).dataset.travelling = "true"; });
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle");
  await expect(page.locator("[data-island-visual][data-net-cut]")).toHaveCount(0);
  expect(await painted(page)).toBe(true);
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
