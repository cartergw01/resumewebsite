import { expect, test, type Page } from "@playwright/test";
import { chooseLanding, distanceFromRim, planShot, project, REST, type Ball } from "../../lib/hoop-shot";
import data from "../../lib/hoop-shot.json" with { type: "json" };

const shot = (page: Page) => page.locator("canvas[data-hoop-shot]");
const ball = (page: Page) => page.locator("[data-workshop-ball]");

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
    check(Math.hypot(landing.x - from.x, landing.y - from.y) >= 1.09, "barely moved", n);
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
  expect(Math.hypot(target.x - first.x, target.y - first.y)).toBeGreaterThan(8);
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

test("it stays on its new spot through a resize and a flip of the lights, with its target", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "One viewport is enough for the layout-independent logic.");
  test.setTimeout(60_000);
  await page.goto("/#projects");
  await tapBall(page);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "flying", { timeout: 15_000 });
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle", { timeout: 20_000 });
  await page.waitForTimeout(100);
  // Across a resize the canvas is never left empty over the still's ball.
  await page.setViewportSize({ width: 1100, height: 680 });
  await expect.poll(() => painted(page)).toBe(true);
  await page.waitForTimeout(300);
  expect(await painted(page)).toBe(true);
  const canvas = (await shot(page).boundingBox())!;
  const target = (await ball(page).locator(":scope > span").boundingBox())!;
  expect(target.x).toBeGreaterThan(canvas.x);
  expect(target.x).toBeLessThan(canvas.x + canvas.width);
  // The other lighting's layers are there for the flip, and the ball's redrawn.
  const lit = await picture(page);
  await page.evaluate(() => { window.dispatchEvent(new CustomEvent("roomlightsintent", { detail: "projects" })); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { document.documentElement.dataset.projectsLights = "off"; window.dispatchEvent(new CustomEvent("roomlightschange", { detail: { world: "projects", on: false } })); });
  await expect.poll(() => picture(page)).not.toBe(lit);
  // A tap still lands on it, wherever it went.
  await tapBall(page);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "flying");
});

test("while it's in the net a tap does nothing, and mid-bounce it can be shot again", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The same logic on every device.");
  test.setTimeout(60_000);
  await page.goto("/#projects");
  await tapBall(page);
  await expect(page.locator("[data-island-visual][data-net-cut]")).toHaveCount(1, { timeout: 20_000 });
  await ball(page).evaluate((node: HTMLElement) => node.click());
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
  await shot(page).evaluate((canvas: HTMLElement) => {
    (window as Window & { rests?: number }).rests = 0;
    new MutationObserver(() => { if (canvas.dataset.hoopShot === "idle") (window as Window & { rests?: number }).rests!++; }).observe(canvas, { attributes: true });
  });
  // Once the net is still, keep tapping as it bounces out: one tap will be far
  // enough from the hoop, and the ball goes back up without ever having rested.
  await expect(page.locator("[data-island-visual][data-net-cut]")).toHaveCount(0, { timeout: 20_000 });
  await ball(page).evaluate((node: HTMLElement) => { const tap = setInterval(() => node.click(), 60); setTimeout(() => clearInterval(tap), 500); });
  await expect(page.locator("[data-island-visual][data-net-cut]")).toHaveCount(1, { timeout: 8_000 });
  expect(await page.evaluate(() => (window as Window & { rests?: number }).rests)).toBe(0);
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

test("the ball, court and hoop are not objects: never a dialog, in or out of the directory", async ({ page }) => {
  await page.goto("/#projects");
  await expect(ball(page)).toBeVisible();
  await expect(page.locator('[data-curio="basketball"], [data-curio="court"], [data-curio="hoop"]')).toHaveCount(0);
  await tapBall(page);
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle", { timeout: 20_000 });
  await page.locator('[data-curio="jersey"]').evaluate((node: HTMLElement) => node.click());
  await page.getByRole("button", { name: "All objects", exact: true }).click();
  await expect(page.locator('[data-discovery-choice="jersey"]')).toBeVisible();
  await expect(page.locator('[data-discovery-choice="basketball"], [data-discovery-choice="court"], [data-discovery-choice="hoop"]')).toHaveCount(0);
});

test("tapping the court does nothing at all", async ({ page }) => {
  await page.goto("/#projects");
  await expect(ball(page)).toBeVisible();
  await page.waitForTimeout(500);
  const floor = (await page.locator("[data-court-floor]").boundingBox())!;
  // Spots across the boards, from data the shot itself uses.
  const spots = await page.evaluate(({ x, y, width }) => {
    const scale = width / 1200;
    return [[760, 520], [880, 560], [960, 600], [1000, 480], [860, 460]].map(([sx, sy]) => [x + sx * scale, y + sy * scale]);
  }, floor);
  const touch = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  let tapped = 0;
  for (const [x, y] of spots) {
    const hit = await page.evaluate(([px, py]) => {
      const node = document.elementFromPoint(px, py) as HTMLElement | null;
      return node?.hasAttribute("data-court-floor") ?? false;
    }, [x, y]);
    if (!hit) continue;
    tapped++;
    if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  }
  expect(tapped).toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("[data-island-stage][data-entering]")).toHaveCount(0);
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle");
});

test("tapping the hoop does nothing at all", async ({ page }) => {
  await page.goto("/#projects");
  await expect(ball(page)).toBeVisible();
  await page.waitForTimeout(500);
  const box = (await page.locator("[data-hoop-inert]").boundingBox())!;
  const scale = box.width / 1200;
  const [x, y, z] = data.world.rim;
  // The board above the rim, the net, and the middle of the pole.
  const touch = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  for (const point of [[x, y + .3, z + .5], [x, y, z - .2], [x, y + .68, 1.4]]) {
    const at = project(point);
    const px = box.x + at.x * scale, py = box.y + at.y * scale;
    expect(await page.evaluate(([a, b]) => document.elementFromPoint(a, b)?.hasAttribute("data-hoop-inert"), [px, py])).toBe(true);
    if (touch) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
  }
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("[data-island-stage][data-entering]")).toHaveCount(0);
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
});

test("tapping the ball or court doesn't light up the monitor; a press on the way in still does", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "Touch feedback only.");
  await page.goto("/#projects");
  await expect(ball(page)).toBeVisible();
  await page.locator("[data-island-link][data-island-objects][data-workshop]").evaluate((link: HTMLElement) => {
    const w = window as Window & { presses?: number };
    w.presses = 0;
    new MutationObserver(records => { for (const record of records) if (record.oldValue === null) w.presses!++; })
      .observe(link, { attributes: true, attributeFilter: ["data-touch-pressed"], attributeOldValue: true });
  });
  const presses = () => page.evaluate(() => (window as Window & { presses?: number }).presses);
  await tapBall(page);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "flying", { timeout: 15_000 });
  const floor = (await page.locator("[data-court-floor]").boundingBox())!;
  await page.touchscreen.tap(floor.x + floor.width * .72, floor.y + floor.height * .72);
  expect(await presses()).toBe(0);
  // A press on the way in, on the island's open ground, still shows the hint.
  const way = await page.evaluate(({ x, y, width, height }) => {
    for (let v = .1; v < .95; v += .04) for (let u = .05; u < .95; u += .04) {
      const px = x + width * u, py = y + height * v;
      if (document.elementFromPoint(px, py)?.closest("[data-island-entry]")) return [px, py];
    }
    return null;
  }, floor);
  expect(way).not.toBeNull();
  await page.touchscreen.tap(way![0], way![1]);
  await expect.poll(presses).toBeGreaterThan(0);
});

test("with reduced motion the ball just moves to its next spot", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#projects");
  const first = await tapBall(page);
  await expect.poll(() => painted(page), { timeout: 15_000 }).toBe(true);
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle");
  const moved = (await ball(page).locator(":scope > span").boundingBox())!;
  expect(Math.hypot(moved.x - first.x, moved.y - first.y)).toBeGreaterThan(10);
});

test("if its layers can't load, a tap does nothing", async ({ page }) => {
  await page.route("**/blender/hoop-shot-*.webp", route => route.abort());
  await page.goto("/#projects");
  await tapBall(page);
  await page.waitForTimeout(1500);
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
  await expect(shot(page)).toHaveAttribute("data-hoop-shot", "idle");
});
