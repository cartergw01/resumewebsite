import { expect, test, type Page } from "@playwright/test";

const worker = '[data-office-explorer] [class*="worker"]';
// His feet, in the art's pixels, read back from the sprite's position.
const feet = (page: Page) => page.locator(worker).evaluate((node: HTMLElement) => {
  const [x, y] = [...node.style.transform.matchAll(/(-?[\d.]+)%/g)].map(match => Number(match[1]));
  return { x: x / 100 * 16 + 8, y: y / 100 * 24 + 22 };
});

// Hold a key until he gets somewhere, or stops moving: frame rates vary, so no fixed times.
async function walk(page: Page, key: string, arrived: (at: { x: number; y: number }) => boolean = () => false) {
  await page.keyboard.down(key);
  let last = await feet(page), still = 0;
  for (let polls = 0; polls < 300 && still < 12; polls++) {
    await page.waitForTimeout(25);
    const at = await feet(page);
    if (arrived(at)) break;
    still = at.x === last.x && at.y === last.y ? still + 1 : 0;
    last = at;
  }
  await page.keyboard.up(key);
  await page.waitForTimeout(40);
  return feet(page);
}

// Rooms can be off camera, so go there the way a keyboard does.
async function sendTo(page: Page, room: string) {
  await page.keyboard.press("Tab");
  const button = page.getByRole("button", { name: room, exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
}

// Click an unobstructed bit of floor, in the art's coordinates.
async function floorAt(page: Page, x: number, y: number) {
  const bounds = (await page.locator('[class*="OfficeExplorer_plan"]').boundingBox())!;
  await page.mouse.click(bounds.x + x / 372 * bounds.width, bounds.y + y / 272 * bounds.height);
  await expect(page.locator(worker)).toHaveAttribute("data-walking", "false");
}

test("the desktop tour uses the viewport and can enter and leave full screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fullscreen is a desktop control.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/work");
  const explorer = page.locator("[data-office-explorer]");
  const map = page.locator("[data-office-map]");
  await expect(page.getByRole("button", { name: "Full screen", exact: true })).toBeVisible();
  const original = (await map.boundingBox())!;
  expect(original.width).toBeGreaterThan(900);
  const start = await feet(page);
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(explorer).toHaveAttribute("data-expanded", "true");
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(page.getByRole("button", { name: "Exit full screen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit full screen" })).toHaveCSS("color", "rgb(255, 255, 255)");
  const enlarged = (await map.boundingBox())!;
  expect(enlarged.width).toBeGreaterThan(original.width);
  expect(enlarged.y + enlarged.height).toBeLessThanOrEqual(900);
  expect(await feet(page)).toEqual(start);
  await page.keyboard.press("Escape");
  await expect(explorer).toHaveAttribute("data-expanded", "false");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await page.getByRole("button", { name: "Read as a list" }).click();
  await expect(explorer).toHaveAttribute("data-expanded", "false");
  await expect(explorer).toHaveAttribute("data-view", "list");
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);

  // Browsers that reject native fullscreen still offer the expanded layout and an exit.
  await page.getByRole("button", { name: "Tour the office" }).click();
  await page.evaluate(() => { HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error("Fullscreen unavailable")); });
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(explorer).toHaveAttribute("data-expanded", "true");
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  expect((await map.boundingBox())!.width).toBeGreaterThan(original.width);
  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect(explorer).toHaveAttribute("data-expanded", "false");
});

test("ikigai has two walkable outer aisles and conversations from different sides", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Keyboard route through the room.");
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/work");
  await sendTo(page, "Building ikigai Launchpad");
  await expect(page.locator("[data-office-explorer]")).toHaveAttribute("data-selected", "accelerator");
  const prompt = page.locator('[class*="OfficeExplorer_prompt"]');
  const openPerson = async (name: string, path: string) => {
    await expect(prompt).toContainText(name);
    const [profile] = await Promise.all([page.context().waitForEvent("page"), page.keyboard.press("Enter")]);
    expect(profile.url()).toContain(path);
    await profile.close();
  };

  await floorAt(page, 100, 112);
  await walk(page, "ArrowUp", at => at.y <= 73);
  await openPerson("Max Hsieh", "/team/max");
  await walk(page, "ArrowUp", at => at.y <= 62);
  expect((await feet(page)).y).toBeLessThanOrEqual(62);
  await floorAt(page, 100, 60);
  await walk(page, "ArrowRight", at => at.x >= 112);
  await openPerson("Max Hsieh", "/team/max");

  await floorAt(page, 184, 112);
  await walk(page, "ArrowUp", at => at.y <= 73);
  await openPerson("Chris Wang", "/team/chris");
  await walk(page, "ArrowUp", at => at.y <= 62);
  expect((await feet(page)).y).toBeLessThanOrEqual(62);
  await walk(page, "ArrowDown", at => at.y >= 110);
  expect((await feet(page)).y).toBeGreaterThanOrEqual(110);
  await floorAt(page, 100, 112);
  await walk(page, "ArrowUp", at => at.y <= 97);
  await expect(prompt).toContainText("Ginny");
  await expect(page.locator('[data-object="ginny"]')).not.toHaveAttribute("href");
});

test("arrow keys walk him through the office and the story follows", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Arrow keys need a keyboard.");
  test.setTimeout(90_000);
  await page.goto("/work");
  const explorer = page.locator("[data-office-explorer]");
  await expect(explorer).toHaveAttribute("data-selected", "now");
  // He starts just inside the door, with a sign, and the sign goes once he sets off.
  await expect(page.getByText("You are here")).toBeVisible();

  // Keys do nothing until the page has hydrated, which a cold dev build can delay.
  const start = await feet(page);
  await expect(async () => {
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(150);
    await page.keyboard.up("ArrowDown");
    expect((await feet(page)).y).toBeGreaterThan(start.y);
  }).toPass({ timeout: 30_000 });

  await expect(page.getByText("You are here")).toHaveCount(0);

  // The desk stops him: the desk's front edge is at 70, and his feet take up 3 more.
  const atDesk = await walk(page, "ArrowUp");
  expect(atDesk.y).toBeGreaterThanOrEqual(70);
  expect(atDesk.y).toBeLessThan(76);

  // Out of the door, along the corridor. Roughly at the Slug Fund door is enough:
  // he is steered into it, and walking in lights the room and brings up its story.
  await walk(page, "ArrowDown", at => at.y >= 136);
  await expect(page.locator(worker)).toHaveAttribute("data-walking", "false");
  const atDoor = await walk(page, "ArrowRight", at => at.x >= 166);
  expect(Math.abs(atDoor.x - 172)).toBeLessThan(14);
  await walk(page, "ArrowDown", at => at.y >= 200);
  await expect(explorer).toHaveAttribute("data-selected", "slug");
  await expect(page.getByRole("heading", { name: "Slug Fund Investment Group" })).toBeAttached();
  expect(await page.evaluate(() => scrollY)).toBe(0);

  // A click still sends him by the doors, from wherever he has got to.
  await sendTo(page, "Contrary Research");
  await expect(explorer).toHaveAttribute("data-selected", "research");
  await expect(page.getByRole("heading", { name: "Contrary Research" })).toBeAttached();
  await expect(page.locator(worker)).toHaveAttribute("data-walking", "false", { timeout: 5000 });

  // Standing at an object, Enter opens the link the copy has for it.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  const [profile] = await Promise.all([page.context().waitForEvent("page"), page.keyboard.press("Enter")]);
  expect(profile.url()).toContain("research.contrary.com/company/turo");
  await profile.close();
});

test("each room's full copy types into the text box, and Enter finishes it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Enter needs a keyboard.");
  await page.goto("/work");
  await expect(page.locator(worker)).toBeVisible();
  const story = page.locator('[class*="textBoxPage"]');
  await expect(story).toContainText("886 Studios");
  await expect(async () => {
    await sendTo(page, "Slug Fund Investment Group");
    await expect(page.locator("[data-office-explorer]")).toHaveAttribute("data-selected", "slug");
  }).toPass();
  await expect(story).toContainText("UC Santa Cruz");
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press("Enter");
  await expect(story.locator('span[style*="hidden"]')).toHaveCount(0);
  // Both paragraphs of the copy, at once.
  await expect(story).toContainText("stepped up and revived the club");
  await expect(story).toContainText("wrote 15+ memos");
});

test("the office and the text box fit on one screen without scrolling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The side-by-side layout is for big screens.");
  await page.goto("/work");
  const bottom = (selector: string) => page.locator(selector).first().evaluate(node => node.getBoundingClientRect().bottom);
  await expect(page.locator(worker)).toBeVisible();
  const height = page.viewportSize()!.height;
  expect(await bottom("[data-office-map]")).toBeLessThanOrEqual(height);
  expect(await bottom('[class*="textBox_"], [class*="textBoxBody"]')).toBeLessThanOrEqual(height);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("tabbing to the details gives the arrow keys back, and people can be reached", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Tabbing needs a keyboard.");
  await page.goto("/work");
  const explorer = page.locator("[data-office-explorer]");
  await expect(explorer).toBeVisible();
  await expect(async () => {
    await sendTo(page, "Building ikigai Launchpad");
    await expect(explorer).toHaveAttribute("data-selected", "accelerator");
  }).toPass();
  await expect(page.locator(worker)).toHaveAttribute("data-walking", "false", { timeout: 5000 });
  const kai = page.getByRole("link", { name: "Kai Huang, Guitar Hero" });
  await expect(kai).toHaveAttribute("href", "https://www.886studios.com/team/kai");
  await page.keyboard.press("Tab");
  await kai.focus();
  await expect(page.locator('[class*="prompt"]')).toContainText("Kai Huang");
  await page.getByRole("button", { name: "Read as a list" }).focus();
  const before = await feet(page);
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.up("ArrowDown");
  expect(await feet(page)).toEqual(before);
});

test("on a phone the pad walks him and the camera follows", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "The pad is for touch screens.");
  test.setTimeout(90_000);
  await page.goto("/work");
  const key = page.locator('[data-key="down"]');
  await expect(key).toBeVisible();
  const plan = page.locator('[class*="OfficeExplorer_plan"]');
  // A phone opens on the whole office, and zooming in lets the camera follow him.
  await expect(page.locator("[data-office-map]")).toHaveAttribute("data-zoomed", "false");
  await page.getByRole("button", { name: "Zoom in" }).tap();
  const start = await feet(page);
  await expect(async () => {
    await key.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", bubbles: true });
    await page.waitForTimeout(250);
    await key.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", bubbles: true });
    expect((await feet(page)).y).toBeGreaterThan(start.y);
  }).toPass({ timeout: 30_000 });
  await key.dispatchEvent("pointerdown", { pointerId: 2, pointerType: "touch", bubbles: true });
  await expect(async () => { expect((await feet(page)).y).toBeGreaterThan(112); }).toPass({ timeout: 8000 });
  await key.dispatchEvent("pointerup", { pointerId: 2, pointerType: "touch", bubbles: true });
  await expect(plan).toHaveAttribute("style", /translate3d\(0px, -\d+px/);
  // The whole office stays whole, and a tap on a far room sends him there.
  await page.getByRole("button", { name: "See whole office" }).tap();
  await page.getByRole("button", { name: "Slug Fund Investment Group", exact: true }).tap();
  await expect(page.locator("[data-office-explorer]")).toHaveAttribute("data-selected", "slug");
  await expect(page.getByRole("heading", { name: "Slug Fund Investment Group" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("tapping around the Office on a phone never launches the rocket", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Tap mode is for touch screens.");
  await page.goto("/work");
  await expect(page.locator('[data-key="up"]')).toBeVisible();
  await page.evaluate(() => {
    (window as Window & { launches?: number }).launches = 0;
    document.addEventListener("rocket-transition-change", event => {
      if ((event as CustomEvent<{ phase: string }>).detail.phase === "launching") (window as Window & { launches?: number }).launches! += 1;
    });
  });
  await page.locator('[class*="OfficeExplorer_textBoxBody"]').click();
  await page.locator('[class*="OfficeExplorer_pad_"]').click({ position: { x: 4, y: 4 } });
  await page.locator('[data-key="up"]').tap();
  await page.getByRole("heading", { name: "Work", exact: true }).first().click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as Window & { launches?: number }).launches)).toBe(0);
});

test("on a phone the Open button says what it does, and opens what he is standing at", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "The pad is for touch screens.");
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/work");
  const open = page.locator('[class*="OfficeExplorer_padAction"]');
  await expect(open).toHaveText("Open");
  // The word has to fit inside the round button, even on the narrowest phone.
  expect(await open.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);

  const explorer = page.locator("[data-office-explorer]");
  await page.getByRole("button", { name: "Contrary Research", exact: true }).tap();
  await expect(explorer).toHaveAttribute("data-selected", "research");
  await expect(page.locator(worker)).toHaveAttribute("data-walking", "false", { timeout: 8000 });
  await expect(open).toHaveAttribute("data-ready", "true");

  // The name bubble says Open too, not a letter, and stays on the map.
  const bubble = page.locator('[class*="OfficeExplorer_prompt"]');
  expect(await bubble.locator("kbd").evaluate(node => getComputedStyle(node, "::after").content)).toBe('"Open"');
  const [inBubble, onStage] = await Promise.all([bubble.boundingBox(), page.locator("[data-office-map]").boundingBox()]);
  expect(inBubble!.x).toBeGreaterThanOrEqual(onStage!.x);
  expect(inBubble!.x + inBubble!.width).toBeLessThanOrEqual(onStage!.x + onStage!.width);

  const [profile] = await Promise.all([page.context().waitForEvent("page"), open.tap()]);
  expect(profile.url()).toContain("research.contrary.com/company/");
  await profile.close();
});

test("on a phone a long story shows there is more, and a tap reads on", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "The fixed text box is for touch screens.");
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/work");
  await page.getByRole("button", { name: "Korobra Capital & side projects", exact: true }).tap();
  const box = page.locator('[class*="OfficeExplorer_textBox_"]');
  const body = page.locator('[class*="OfficeExplorer_textBoxBody"]');
  await expect(box).toHaveAttribute("data-typing", "false", { timeout: 5000 });
  const arrow = page.locator('[class*="OfficeExplorer_textBoxMore"]');
  await expect(arrow).toBeVisible();
  // The whole story is there to scroll to, with nothing left blank below the fold.
  await expect(page.locator('[class*="textBoxPage"] span[style*="hidden"]')).toHaveCount(0);
  // Tapping pages down until the end, where the arrow goes.
  await expect(async () => {
    // In the box's top padding, so the tap can't land on one of the story's links.
    await body.tap({ position: { x: 100, y: 3 } });
    await page.waitForTimeout(350);
    await expect(arrow).toBeHidden({ timeout: 100 });
  }).toPass({ timeout: 15_000 });
  expect(await body.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(await body.evaluate(node => node.scrollTop + node.clientHeight >= node.scrollHeight - 6)).toBe(true);
  // The next room starts from its top, and says who and when.
  await page.getByRole("button", { name: "Contrary Research", exact: true }).tap();
  await expect(box).toHaveAttribute("data-typing", "false", { timeout: 5000 });
  expect(await body.evaluate(node => node.scrollTop)).toBe(0);
  const role = page.locator('[class*="OfficeExplorer_textBoxRole"]');
  await expect(role).toContainText("Research Fellow");
  await expect(role).toContainText("March 2023 - March 2024");
});

test("on a phone the view button holds its corner, and the page stops changing height between rooms", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "The compact heading is for phones.");
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/work");
  const toList = page.getByRole("button", { name: "Read as a list" });
  await expect(toList).toBeInViewport({ ratio: 1 });
  const corner = (await toList.boundingBox())!;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.getByRole("button", { name: "Finding founders", exact: true }).tap();
  await expect(page.locator("[data-office-explorer]")).toHaveAttribute("data-selected", "founders");
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
  await toList.tap();
  const toOffice = page.getByRole("button", { name: "Tour the office" });
  await expect(toOffice).toBeVisible();
  const after = (await toOffice.boundingBox())!;
  expect(Math.abs(after.y - corner.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.x + after.width - corner.x - corner.width)).toBeLessThanOrEqual(1);
  await toOffice.tap();
  await expect(page.locator('[data-key="up"]')).toBeVisible();
});

test("a phone on its side has the office and the story side by side", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "For touch screens.");
  await page.setViewportSize({ width: 664, height: 390 });
  await page.goto("/work");
  const map = (await page.locator("[data-office-map]").boundingBox())!;
  const story = (await page.locator('[class*="OfficeExplorer_textBox_"]').boundingBox())!;
  const pad = (await page.locator('[class*="OfficeExplorer_pad_"]').boundingBox())!;
  expect(story.x).toBeGreaterThanOrEqual(map.x + map.width);
  expect(pad.x).toBeGreaterThanOrEqual(story.x + story.width);
  // The D-pad holds the right edge either way up.
  const cross = (await page.locator('[class*="OfficeExplorer_padCross"]').boundingBox())!;
  expect(cross.x + cross.width).toBeGreaterThan(664 - 24);
  expect(map.y + map.height).toBeLessThanOrEqual(390);
  expect(pad.y + pad.height).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

for (const [width, height] of [[390, 844], [390, 664], [375, 667], [320, 640]]) {
  test(`the site nav never sits on the walking controls at ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "The pad is for touch screens.");
    await page.setViewportSize({ width, height });
    await page.goto("/work");
    const pad = page.locator('[class*="OfficeExplorer_pad_"]');
    const dock = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(pad).toBeAttached();
    // The story opens in view, above the site nav and with the keys beneath it.
    const story = page.locator('[class*="OfficeExplorer_textBox_"]');
    const opening = (await story.boundingBox())!;
    expect(opening.y).toBeLessThan((await dock.boundingBox())!.y - 64);
    // The D-pad sits beside it on the right, with its button in the very middle.
    const cross = (await page.locator('[class*="OfficeExplorer_padCross"]').boundingBox())!;
    expect(cross.x).toBeGreaterThanOrEqual(opening.x + opening.width);
    expect(cross.x + cross.width).toBeLessThanOrEqual(width);
    const hub = (await page.locator('[class*="OfficeExplorer_padAction"]').boundingBox())!;
    expect(Math.abs(hub.x + hub.width / 2 - cross.x - cross.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(hub.y + hub.height / 2 - cross.y - cross.height / 2)).toBeLessThanOrEqual(1);
    // On anything from 640 tall, office, story and keys all fit above the nav before any scrolling.
    if (height >= 660) expect(cross.y + cross.height).toBeLessThanOrEqual((await dock.boundingBox())!.y);
    const covered = async () => {
      const keys = (await pad.boundingBox())!;
      const nav = await dock.evaluate(node => { const box = node.getBoundingClientRect(); return { top: box.top, shown: getComputedStyle(node).opacity !== "0" && box.top < innerHeight }; });
      return nav.shown && keys.y + keys.height > nav.top;
    };
    // Pressing any key brings the map and the pad clear, however short the screen.
    const key = page.locator('[data-key="up"]');
    await expect(async () => {
      await key.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", bubbles: true });
      await key.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", bubbles: true });
      expect(await covered()).toBe(false);
    }).toPass({ timeout: 15_000 });
    await expect(page.locator("[data-office-map]")).toBeInViewport();
    await expect(pad).toBeInViewport({ ratio: 1 });
    // And the bottom of the page is reachable, with the nav clear of the story.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect(dock).toBeInViewport({ ratio: 1 });
    const keys = (await pad.boundingBox())!;
    expect(keys.y + keys.height).toBeLessThanOrEqual((await dock.boundingBox())!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}
