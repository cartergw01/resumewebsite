import { expect, test, type Page } from "@playwright/test";

async function openObject(page: Page, selector: string, mobile: boolean) {
  const object = page.locator(selector);
  await expect(object).toBeVisible();
  const box = (await object.boundingBox())!;
  if (mobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else { await object.focus(); await page.keyboard.press("Enter"); }
}
const gameFixture = '<title>Taipei Run test session</title><button onclick="this.textContent=\'Session started\'">Start session</button>';

test("desk thoughts preserve the original voice, remember the last post, and leave the notebook usable", async ({ page, isMobile }, testInfo) => {
  const errors: string[] = [];
  const remoteRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/^https:\/\/(?:x\.com|platform\.twitter\.com|taipeirun\.com)/.test(request.url())) remoteRequests.push(request.url()); });
  await page.addInitScript(() => {
    if (localStorage.getItem("carter-thoughts-last-v1") === null) {
      localStorage.setItem("carter-thoughts-last-v1", "2104108558929502655");
    }
  });
  await page.goto("/#writing");
  await expect(page).toHaveTitle(/Carter/);
  await expect(page.locator('#writing [data-island-visual]')).toHaveAttribute("data-parallax", "on", { timeout: 30_000 });
  await openObject(page, "[data-thought-cards]", isMobile);
  const dialog = page.getByRole("dialog", { name: "A stream of consciousness" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close thoughts" })).toBeFocused();
  await expect.poll(() => page.locator("[data-background-video]").evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-overlay", "true");
  await expect.poll(() => page.locator('#writing [data-island-visual]').evaluate(node => getComputedStyle(node).animationPlayState.split(",").every(state => state.trim() === "paused"))).toBe(true);
  await expect(dialog.getByText("1 of 26", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/the conclusion isn’t predetermined, but discovered\./)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "View on X" })).toHaveAttribute("href", "https://x.com/CarterKoWang/status/2080978926567067695");
  await expect(dialog.getByRole("button", { name: /save|saved|shuffle|copy link/i })).toHaveCount(0);
  const avatar = dialog.locator('img');
  await expect(avatar).toHaveAttribute("src", /x-profile\.jpg/);
  await expect.poll(() => avatar.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(dialog).toHaveAttribute("data-note-motion", "idle");
  await page.screenshot({ path: `/tmp/carter-thoughts-${testInfo.project.name}.png` });
  await expect(dialog.getByText("after all…no pain, no gain.", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-thought-cards]")).toBeFocused();
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-overlay");
  await page.reload();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await openObject(page, "[data-thought-cards]", isMobile);
  await dialog.getByRole("button", { name: "Next thought" }).click();
  const nextId = await dialog.locator("article").getAttribute("data-thought-id");
  await dialog.getByRole("button", { name: "Close thoughts" }).click();
  await expect(dialog).toHaveCount(0);
  await openObject(page, "[data-thought-cards]", isMobile);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", nextId!);
  await dialog.getByRole("button", { name: "Previous thought" }).click();
  await expect(dialog.getByText("1 of 26", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close thoughts" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(remoteRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("[data-writing-entry]").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/writing$/);
});

test("shared thoughts work without storage and removed promotional links fall back gracefully", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } });
  });
  await page.goto("/?thought=1944727397909279094#writing");
  const dialog = page.getByRole("dialog", { name: "A stream of consciousness" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", "1944727397909279094");
  await expect(dialog.getByRole("navigation", { name: "Thought collection" })).toHaveCount(0);
  await expect(dialog.getByText("Originally shared with a quoted post.", { exact: false })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "View the context on X" })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "View on X", exact: true })).toHaveAttribute("href", "https://x.com/CarterKoWang/status/1944727397909279094");
  await expect(dialog.locator('a:not([href^="https://x.com/"])')).toHaveCount(0);
  await dialog.getByRole("button", { name: "Next thought" }).click();
  await expect(dialog.locator("article")).not.toHaveAttribute("data-thought-id", "1944727397909279094");
  await dialog.getByRole("button", { name: "Close thoughts" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/#writing$/);
  await expect(page.locator("[data-thought-cards]")).toBeFocused();
  // An old shared link must never resurrect the removed Taipei Run launch post.
  await page.goto("/?thought=2104108558929502655#writing");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", "2080978926567067695");
  await expect(dialog.getByText("1 of 26", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the note stack handles interrupted lifts and reduced motion", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Hold the first lift midway so the interruption check is independent of
  // browser speed; later animations, including the exit, run normally.
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    let held = false;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (!held && this.hasAttribute("data-note-stack")) {
        held = true;
        animation.pause();
        animation.currentTime = 140;
      }
      return animation;
    };
  });
  await page.goto("/#writing");
  await expect(page.locator('#writing [data-island-visual]')).toHaveAttribute("data-parallax", "on", { timeout: 30_000 });
  const dialog = page.getByRole("dialog", { name: "A stream of consciousness" });
  await openObject(page, "[data-thought-cards]", isMobile);
  await expect(dialog).toHaveAttribute("data-note-motion", "opening");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-thought-cards]")).toBeFocused();
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-overlay");

  await openObject(page, "[data-thought-cards]", isMobile);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dialog).toHaveAttribute("data-note-motion", "idle");
  await expect(dialog.locator("[data-note-sheet]")).toHaveCount(2);
  await expect.poll(() => dialog.locator("[data-note-stack]").evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await dialog.getByRole("button", { name: "Close thoughts" }).click();
  await expect(dialog).toHaveCount(0);

  await openObject(page, "[data-thought-cards]", isMobile);
  await expect(dialog).toHaveAttribute("data-note-motion", "idle");
  await expect.poll(() => dialog.locator("[data-note-stack]").evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe("hidden");
  expect(errors).toEqual([]);
});

test("the cabinet loads the game on demand, reloads it, and releases it on close", async ({ page, isMobile }) => {
  let gameRequests = 0;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://taipeirun.com/", route => { gameRequests++; return route.fulfill({ contentType: "text/html", body: gameFixture }); });
  await page.goto("/#projects");
  await expect(page.locator('#projects [data-island-visual]')).toHaveAttribute("data-parallax", "on", { timeout: 30_000 });
  expect(gameRequests).toBe(0);
  const videoWasPlaying = await page.locator("[data-background-video]").evaluate((video: HTMLVideoElement) => !video.paused);
  await openObject(page, '[data-workshop-object="taipei-run"]', isMobile);
  const arcade = page.getByRole("dialog", { name: "Taipei Run" });
  await expect(arcade).toBeVisible();
  await expect(arcade.getByRole("button", { name: "Back to workshop" })).toBeFocused();
  await expect(page.frameLocator('iframe[title="Taipei Run game"]').getByRole("button", { name: "Start session" })).toBeVisible();
  await expect.poll(() => gameRequests).toBe(1);
  await expect.poll(() => page.locator("[data-background-video]").evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await arcade.getByRole("button", { name: "Reload game" }).click();
  await expect.poll(() => gameRequests).toBe(2);
  await page.keyboard.press("Escape");
  await expect(arcade).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator('[data-workshop-object="taipei-run"]')).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe("hidden");
  if (videoWasPlaying) await expect.poll(() => page.locator("[data-background-video]").evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("a stalled arcade request offers retry and a full-game fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Network recovery is viewport-independent.");
  let release: (() => void) | undefined;
  let count = 0;
  await page.route("https://taipeirun.com/", async route => {
    if (++count === 1) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ contentType: "text/html", body: gameFixture }).catch(() => {});
  });
  await page.goto("/?play=taipei-run#projects");
  const arcade = page.getByRole("dialog", { name: "Taipei Run" });
  await expect(arcade).toBeVisible();
  await expect(arcade.getByText("Starting the arcade…")).toBeVisible();
  await expect(arcade.getByText("The arcade is taking a little longer.")).toBeVisible({ timeout: 15_000 });
  await expect(arcade.getByRole("link", { name: "Open full game", exact: false })).toHaveAttribute("href", "https://taipeirun.com/");
  await arcade.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.frameLocator('iframe[title="Taipei Run game"]').getByRole("button", { name: "Start session" })).toBeVisible();
  release?.();
  await arcade.getByRole("button", { name: "Back to workshop" }).click();
  await expect(arcade).toHaveCount(0);
});
