import { expect, test } from "@playwright/test";

test("all three island controls align and stay clear of art and navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Touch behavior is covered by the switch tests below.");
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#work");
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 1280, height: 720 },
    { width: 1024, height: 768 }, { width: 768, height: 1024 },
    { width: 390, height: 844 }, { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    let firstPosition: { x: number; y: number } | undefined;
    for (const world of ["work", "writing", "projects"]) {
      await page.getByRole("button", { name: `Show ${world} island`, exact: false }).click();
      await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
      const scene = page.locator(`#${world}`);
      const control = scene.getByRole("switch");
      await expect(control).toBeInViewport({ ratio: 1 });
      const button = (await control.boundingBox())!;
      const art = (await scene.locator("[data-scene-art]").boundingBox())!;
      const navigation = (await page.locator("[data-scene-nav]").boundingBox())!;
      expect(button.height).toBeGreaterThanOrEqual(44);
      // The wall switch sits just under the stop's line, on its left edge,
      // and clear of the artwork's rendered 3:2 frame.
      const line = (await scene.locator("[data-scene-copy] p").first().boundingBox())!;
      expect(button.x).toBeCloseTo(line.x, 0);
      expect(button.y - (line.y + line.height)).toBeGreaterThanOrEqual(8);
      expect(button.y - (line.y + line.height)).toBeLessThan(32);
      const frameTop = art.y + (art.height - Math.min(art.height, art.width * 2 / 3)) / 2;
      const frameLeft = art.x + (art.width - Math.min(art.width, art.height * 3 / 2)) / 2;
      expect(button.y + button.height <= frameTop || button.x + button.width <= frameLeft).toBe(true);
      expect(button.y + button.height).toBeLessThanOrEqual(navigation.y);
      if (firstPosition) {
        expect(button.x).toBeCloseTo(firstPosition.x, 1);
        expect(button.y).toBeCloseTo(firstPosition.y, 1);
      } else firstPosition = button;
      // Verify the entire control receives clicks, rather than an invisible
      // navigation layer or the artwork behind it.
      expect(await control.evaluate(node => {
        const box = node.getBoundingClientRect();
        return [8, box.width / 2, box.width - 8].every(x =>
          node.contains(document.elementFromPoint(box.x + x, box.y + box.height / 2)));
      })).toBe(true);
      await expect(control.locator("span[aria-hidden]")).toHaveCSS("box-shadow", "none");
    }
  }
});

for (const [world, room] of [["writing", "study"], ["projects", "workshop"]] as const) {
  test(`the ${room} light switch turns its lights off and on, and is remembered`, async ({ page, isMobile }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/#${world}`);
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
    const html = page.locator("html");
    const lightsSwitch = page.getByRole("switch", { name: `${room} lights` });
    await expect(lightsSwitch).toHaveAttribute("aria-checked", "true");
    await expect(lightsSwitch).toHaveText("Lights");
    // The island's transform can round an edge by a fraction of a pixel in WebKit.
    await expect(lightsSwitch).toBeInViewport({ ratio: 0.999 });
    expect((await lightsSwitch.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (isMobile) await lightsSwitch.click();
    else { await lightsSwitch.focus(); await page.keyboard.press("Space"); }
    // The lights-off still is fetched on intent and crossfades in.
    await expect(html).toHaveAttribute(`data-${world}-lights`, "off");
    await expect(page.locator(`img[data-lights-off="${world}"]`)).toHaveCount(1);
    const onSwitch = page.getByRole("switch", { name: `${room} lights` });
    await expect(onSwitch).toHaveAttribute("aria-checked", "false");
    // Each room has its own switch: the other room stays lit.
    const other = world === "writing" ? "projects" : "writing";
    await expect(html).not.toHaveAttribute(`data-${other}-lights`, "off");
    // Remembered between visits.
    await page.reload();
    await expect(html).toHaveAttribute(`data-${world}-lights`, "off");
    await expect(page.getByRole("switch", { name: `${room} lights` })).toBeVisible();
    await page.getByRole("switch", { name: `${room} lights` }).click();
    await expect(html).not.toHaveAttribute(`data-${world}-lights`, "off");
    expect(errors).toEqual([]);
  });
}

for (const [world, room] of [["writing", "study"], ["projects", "workshop"]] as const) {
  test(`settling on the ${room} readies its staged switch, on phones too`, async ({ page }) => {
    await page.goto(`/#${world}`);
    const visual = page.locator(`#${world} [data-island-visual]`);
    // The lights-off still and the light masks load once the room is settled,
    // and the canvas that plays the switch takes over from the images.
    await expect(visual).toHaveAttribute("data-lights-gl", "ready", { timeout: 30_000 });
    await expect(visual).toHaveAttribute("data-parallax", "on");
    await expect(page.locator(`img[data-lights-off="${world}"]`)).toHaveCount(1);
    await page.getByRole("switch", { name: `${room} lights` }).click();
    await expect(page.locator("html")).toHaveAttribute(`data-${world}-lights`, "off");
    // The switch didn't wait: everything it needed was already there.
    await expect(page.getByRole("switch", { name: `${room} lights` })).not.toHaveAttribute("aria-busy", "true");
  });
}
