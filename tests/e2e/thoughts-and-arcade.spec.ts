import { expect, test, type Page } from "@playwright/test";

async function openObject(page: Page, selector: string, mobile: boolean) {
  const object = page.locator(selector);
  await expect(object).toBeVisible();
  const box = (await object.boundingBox())!;
  if (mobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else { await object.focus(); await page.keyboard.press("Enter"); }
}
const gameFixture = '<title>Taipei Run test session</title><button onclick="this.textContent=\'Session started\'">Start session</button>';

test("desk thoughts preserve the original voice, save across visits, and leave the notebook usable", async ({ page, isMobile }, testInfo) => {
  const errors: string[] = [];
  const remoteRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/^https:\/\/(?:x\.com|platform\.twitter\.com|taipeirun\.com)/.test(request.url())) remoteRequests.push(request.url()); });
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
  await expect(dialog.getByText("1 of 30", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/the conclusion isn’t predetermined, but discovered\./)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "View on X" })).toHaveAttribute("href", "https://x.com/CarterKoWang/status/2080978926567067695");
  await dialog.getByRole("button", { name: "Save thought", exact: true }).click();
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
  await dialog.getByRole("button", { name: "Saved · 1", exact: true }).click();
  await expect(dialog.getByText("1 of 1", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Next thought" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Unsave thought", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Keep a thought for later." })).toBeVisible();
  await dialog.getByRole("button", { name: "Browse all thoughts" }).click();
  await dialog.getByRole("button", { name: "Next thought" }).click();
  const nextId = await dialog.locator("article").getAttribute("data-thought-id");
  await dialog.getByRole("button", { name: "Close thoughts" }).click();
  await openObject(page, "[data-thought-cards]", isMobile);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", nextId!);
  await dialog.getByRole("button", { name: "Shuffle" }).click();
  await expect(dialog.locator("article")).not.toHaveAttribute("data-thought-id", nextId!);
  await dialog.getByRole("button", { name: "Close thoughts" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(remoteRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("[data-writing-entry]").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/writing$/);
});

test("a shared thought works without storage and connects to the playable arcade", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("Clipboard blocked"); } } });
  });
  await page.route("https://taipeirun.com/", route => route.fulfill({ contentType: "text/html", body: gameFixture }));
  await page.goto("/?thought=2104108558929502655#writing");
  const dialog = page.getByRole("dialog", { name: "A stream of consciousness" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", "2104108558929502655");
  await dialog.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "Link to this thought" })).toHaveValue(/\?thought=2104108558929502655#writing$/);
  await dialog.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(dialog.getByText("Saved for this visit.", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("navigation", { name: "Thought collection" }).getByRole("button")).toHaveCount(2);
  await dialog.getByRole("link", { name: /Play Taipei Run/ }).click();
  const arcade = page.getByRole("dialog", { name: "Taipei Run" });
  await expect(arcade).toBeVisible();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  await page.frameLocator('iframe[title="Taipei Run game"]').getByRole("button", { name: "Start session" }).click();
  await expect(page.frameLocator('iframe[title="Taipei Run game"]').getByRole("button", { name: "Session started" })).toBeVisible();
  await page.screenshot({ path: `/tmp/carter-arcade-shell-${testInfo.project.name}.png` });
  await arcade.getByRole("button", { name: "Back to workshop" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page).toHaveURL(/\/#projects$/);
  await expect(page.locator('[data-workshop-object="taipei-run"]')).toBeFocused();
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
