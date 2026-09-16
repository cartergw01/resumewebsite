import { expect, test, type Page } from "@playwright/test";

async function cross(page: Page, journey: number, progress: number) {
  await page.evaluate(({ journey, progress }) => {
    const position = (journey + 0.34 + progress * 0.54) / 2.5;
    scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * position, behavior: "instant" });
  }, { journey, progress });
  await expect.poll(() => page.locator("[data-island-stage]").evaluate((stage) => {
    const actual = Number((stage as HTMLElement).style.getPropertyValue("--camera-progress"));
    return Math.abs(actual - scrollY / (document.documentElement.scrollHeight - innerHeight));
  })).toBeLessThan(0.0002);
}

async function pose(page: Page, world: string) {
  return page.locator(`#${world} [data-scene-art]`).evaluate((art) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(art).transform);
    return { x: matrix.m41, y: matrix.m42, scale: Math.hypot(matrix.a, matrix.b), transform: getComputedStyle(art).transform };
  });
}

test("camera pulls back, follows opposite arcs, and retraces the same path", async ({ page }) => {
  await page.goto("/2.0");
  for (const [journey, from, to, direction] of [[0, "work", "writing", 1], [1, "writing", "projects", -1]] as const) {
    await cross(page, journey, 0);
    const start = await pose(page, from);
    await cross(page, journey, 0.2);
    const retreat = await pose(page, from);
    expect(retreat.scale).toBeLessThan(start.scale * 0.75);
    expect(Math.abs(retreat.x - start.x)).toBeLessThan(page.viewportSize()!.width * 0.2);
    await cross(page, journey, 0.55);
    const departing = await pose(page, from);
    const incoming = await pose(page, to);
    expect(departing.scale).toBeLessThan(retreat.scale);
    expect(incoming.scale).toBeLessThan(0.7);
    expect(incoming.y * direction).toBeGreaterThan(25);
    await expect(page.locator(`#${from}`)).toHaveCSS("opacity", "1");
    await expect(page.locator(`#${to}`)).toHaveCSS("opacity", "1");
    await expect.poll(() => page.locator("[data-flight-stars]").evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.4);
    const depth = await page.evaluate(() => ["[data-galaxy-camera]", '[data-depth-stars="middle"]', '[data-depth-stars="near"]'].map(selector => new DOMMatrixReadOnly(getComputedStyle(document.querySelector(selector)!).transform).m41));
    expect(Math.abs(depth[2])).toBeGreaterThan(Math.abs(depth[1]) * 1.5);
    expect(Math.abs(depth[1])).toBeGreaterThan(Math.abs(depth[0]) * 2);
    await cross(page, journey, 1);
    expect((await pose(page, to)).scale).toBeCloseTo(1, 3);
    await expect(page.locator("[data-flight-stars]")).toHaveCSS("opacity", "0");
    await cross(page, journey, 0.55);
    const reversed = await pose(page, to);
    expect(reversed.x).toBeCloseTo(incoming.x, 0);
    expect(reversed.y).toBeCloseTo(incoming.y, 0);
    expect(reversed.scale).toBeCloseTo(incoming.scale, 2);
  }
});

test("island settles before its lights, heading, and annotation arrive", async ({ page }) => {
  await page.goto("/2.0");
  for (const [journey, world] of [[0, "writing"], [1, "projects"]] as const) {
    const copy = page.locator(`#${world} [data-scene-copy]`);
    const cue = page.locator(`#${world} [data-island-link] > span:last-child`);
    const brightness = () => page.locator(`#${world} [data-island-visual]`).evaluate(el => Number(getComputedStyle(el).filter.match(/brightness\(([^)]+)\)/)?.[1]));
    await cross(page, journey, 0.84);
    expect((await pose(page, world)).scale).toBeCloseTo(1, 3);
    expect(await brightness()).toBeLessThan(0.65);
    await expect(copy).toHaveCSS("opacity", "0");
    await expect(cue).toHaveCSS("opacity", "0");
    await cross(page, journey, 0.93);
    expect(await brightness()).toBeCloseTo(1, 2);
    expect(Number(await copy.evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0);
    await expect(cue).toHaveCSS("opacity", "0");
    // Sample inside the settled hold; native scroll positions round to pixels.
    await cross(page, journey, 1.02);
    await expect(copy).toHaveCSS("opacity", "1");
    await expect(cue).toHaveCSS("opacity", "1");
  }
});

test("entry centers each landmark, including when clicked during flight", async ({ page }) => {
  for (const [world, name, fx, fy, midFlight] of [
    ["work", "Taipei tower", 0.588, 0.278, false],
    ["writing", "open book", 0.52, 0.43, false],
    ["projects", "workshop laptop", 0.705, 0.345, false],
    ["work", "Taipei tower", 0.588, 0.278, true],
  ] as const) {
    await page.goto(`/2.0#${world}`);
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
    if (midFlight) await cross(page, 0, 0.3);
    const visual = page.locator(`#${world} [data-island-visual]`);
    // Keyboard activation doesn't scroll a moving link into the center first.
    await page.locator(`#${world} [data-island-link]`).focus();
    await page.keyboard.press("Enter");
    await expect(visual).toHaveAttribute("data-entry-landmark", name);
    const point = await visual.evaluate((node: HTMLElement, { fx, fy }) => {
      const animation = node.getAnimations().find(animation => (animation.effect as KeyframeEffect).getKeyframes().some(frame => frame.transformOrigin))!;
      animation.pause();
      animation.currentTime = 999;
      const image = node.querySelector("img")!;
      const fit = Math.min(node.offsetWidth / image.naturalWidth, node.offsetHeight / image.naturalHeight);
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;left:${(node.offsetWidth - image.naturalWidth * fit) / 2 + image.naturalWidth * fit * fx}px;top:${(node.offsetHeight - image.naturalHeight * fit) / 2 + image.naturalHeight * fit * fy}px;width:0;height:0;`;
      node.append(probe);
      const rect = probe.getBoundingClientRect();
      probe.remove();
      return { x: rect.x, y: rect.y, centerX: innerWidth / 2, centerY: innerHeight / 2 };
    }, { fx, fy });
    expect(Math.abs(point.x - point.centerX)).toBeLessThan(5);
    expect(Math.abs(point.y - point.centerY)).toBeLessThan(5);
    await visual.evaluate(node => node.getAnimations().forEach(animation => animation.play()));
    await expect(page).toHaveURL(new RegExp(`/${world}$`));
  }
});
