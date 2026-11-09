import { expect, test } from "@playwright/test";

test("the opening Writing island includes its perched bird", async ({ page }, info) => {
  await page.goto("/");
  const overview = page.locator('[data-overview="intro"]');
  const bird = overview.locator('[data-overview-bird]');
  await expect(bird).toBeVisible();
  const island = bird.locator('xpath=ancestor::a');
  await expect(island).toHaveAttribute("href", "/writing");
  const birdBox = (await bird.boundingBox())!;
  const islandBox = (await island.boundingBox())!;
  expect(birdBox.x).toBeGreaterThan(islandBox.x);
  expect(birdBox.x + birdBox.width).toBeLessThan(islandBox.x + islandBox.width);
  await page.screenshot({ path: `/tmp/carter-overview-bird-${info.project.name}.png` });
});

test("the bird opens the same notes and restores focus without replaying the invitation", async ({ page, isMobile }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#writing");
  const cues = page.locator("[data-thought-cues]");
  const bird = page.getByRole("button", { name: "some of my tweets", exact: true });
  await expect(cues).toHaveAttribute("data-cue-state", "playing");
  const box = (await bird.boundingBox())!;
  // Transformed bounds can differ from the 44px target by a fraction of a pixel.
  expect(box.width).toBeGreaterThanOrEqual(43.9);
  expect(box.height).toBeGreaterThanOrEqual(43.9);
  await page.screenshot({ path: `/tmp/carter-bird-${info.project.name}.png` });
  if (isMobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else { await bird.focus(); await page.keyboard.press("Enter"); }
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  await expect(dialog).toBeVisible();
  await expect(cues).toHaveAttribute("data-cue-state", "done");
  await expect.poll(() => cues.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(bird).toBeFocused();
  await expect(cues).toHaveAttribute("data-cue-state", "done");
  await page.locator("[data-thought-cards]").focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-thought-cards]")).toBeFocused();
  expect(errors).toEqual([]);
});

test("project cues settle, leave props quiet, and respect reduced motion", async ({ page, isMobile }, info) => {
  await page.goto("/#projects");
  const cues = page.locator("[data-workshop-objects]");
  await expect(cues).toHaveAttribute("data-cue-state", "playing");
  await expect(cues.locator("[data-project-cue]")).toHaveCount(5);
  await expect(cues.locator("[data-curio][data-tip], [data-curio] [data-project-cue]")).toHaveCount(0);
  for (const object of await page.locator("[data-workshop-object]").all()) {
    const box = (await object.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(43.9);
    expect(box.height).toBeGreaterThanOrEqual(43.9);
  }
  await page.screenshot({ path: `/tmp/carter-project-cues-${info.project.name}.png` });
  await expect(cues).toHaveAttribute("data-cue-state", "done", { timeout: 6000 });
  await expect.poll(() => cues.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
  if (!isMobile) {
    const stocker = page.locator('[data-workshop-object="stocker"]');
    const pin = (await stocker.locator('span').first().boundingBox())!;
    await page.mouse.move(pin.x, pin.y);
    const trace = stocker.locator('[data-stock-trace]');
    await expect(trace).toHaveCSS("opacity", "1");
    await expect(trace).toHaveCSS("stroke-dashoffset", "0px");
    await expect.poll(() => trace.evaluate(node => node.getAnimations().every(animation => animation.playState === "finished"))).toBe(true);
    await expect(trace).toHaveCSS("opacity", "1");
    await page.mouse.move(20, 20);
    await expect(trace).toHaveCSS("opacity", "0");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("[data-workshop-object]")).toHaveCount(5);
  await expect.poll(() => cues.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await page.goto("/#writing");
  await expect(page.locator("[data-thought-bird]")).toBeVisible();
  await expect.poll(() => page.locator("[data-thought-cues]").evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await page.locator("[data-thought-bird]").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Posts by Carter" })).toBeVisible();
});

test("the bird stays on its branch while the island travels, and can't be tapped mid-flight", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#writing");
  const bird = page.locator("[data-thought-bird]");
  await expect(bird).toBeVisible();
  const stage = page.locator("[data-island-stage]");
  await expect(stage).toHaveAttribute("data-travelling", "false");
  const rest = (await bird.boundingBox())!;
  // Part-way towards the next island, without a gesture that would settle it.
  // Desktop holds each island for a while, so step until the crossing starts.
  const start = await page.evaluate(() => scrollY);
  await page.evaluate(async () => {
    const stage = document.querySelector<HTMLElement>("[data-island-stage]")!;
    for (let i = 0; i < 200 && stage.dataset.travelling !== "true"; i++) {
      scrollTo({ top: scrollY + 8, behavior: "instant" });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    scrollTo({ top: scrollY + 40, behavior: "instant" });
  });
  await expect(stage).toHaveAttribute("data-travelling", "true");
  await expect(bird).toBeVisible();
  expect(await bird.evaluate(node => getComputedStyle(node).pointerEvents)).toBe("none");
  // It moves with the island rather than hanging where the branch used to be.
  const moving = (await bird.boundingBox())!;
  expect(Math.hypot(moving.x - rest.x, moving.y - rest.y)).toBeGreaterThan(2);
  await page.evaluate(top => scrollTo({ top, behavior: "instant" }), start);
  await expect(stage).toHaveAttribute("data-travelling", "false");
  expect(await bird.evaluate(node => getComputedStyle(node).pointerEvents)).toBe("auto");
});
