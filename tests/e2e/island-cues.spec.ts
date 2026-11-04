import { expect, test } from "@playwright/test";

test("the bird opens the same notes and restores focus without replaying the invitation", async ({ page, isMobile }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#writing");
  const cues = page.locator("[data-thought-cues]");
  const bird = page.getByRole("button", { name: "some of my tweets", exact: true });
  await expect(cues).toHaveAttribute("data-cue-state", "playing");
  const box = (await bird.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
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
