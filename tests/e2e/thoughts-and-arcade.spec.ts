import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const thoughts = JSON.parse(readFileSync(new URL("../../content/thoughts.json", import.meta.url), "utf8")) as { id: string; text: string; source: string }[];

async function openObject(page: Page, selector: string, mobile: boolean) {
  const object = page.locator(selector);
  await expect(object).toBeVisible();
  const box = (await object.boundingBox())!;
  if (mobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else { await object.focus(); await page.keyboard.press("Enter"); }
}
const gameFixture = '<title>Taipei Run test session</title><button onclick="this.textContent=\'Session started\'">Start session</button>';

async function expectOriginalThought(dialog: Locator) {
  const id = await dialog.locator("article").getAttribute("data-thought-id");
  const thought = thoughts.find(thought => thought.id === id);
  expect(thought, "The selected tweet belongs to the curated collection").toBeDefined();
  await expect(dialog.locator("article p")).toHaveText(thought!.text.split(/\n\s*\n/));
  await expect(dialog.getByRole("link", { name: "View on X", exact: true })).toHaveAttribute("href", thought!.source);
  await expect(dialog.getByRole("status")).toHaveText(`${thoughts.indexOf(thought!) + 1} of ${thoughts.length}`);
  return thought!.id;
}

test("desk thoughts open randomly, shuffle without immediate repeats, and leave the notebook usable", async ({ page, isMobile }, testInfo) => {
  const errors: string[] = [];
  const remoteRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/^https:\/\/(?:x\.com|platform\.twitter\.com|taipeirun\.com)/.test(request.url())) remoteRequests.push(request.url()); });
  // A prior reading should not pin every new visit to the same tweet.
  await page.addInitScript(id => localStorage.setItem("carter-thoughts-last-v1", id), thoughts[0].id);
  await page.goto("/#writing");
  await expect(page).toHaveTitle(/Carter/);
  await expect(page.locator('#writing [data-island-visual]')).toHaveAttribute("data-parallax", "on", { timeout: 30_000 });
  await openObject(page, "[data-thought-cards]", isMobile);
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close thoughts" })).toBeFocused();
  await expect.poll(() => page.locator("[data-background-video]").evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await expect(page.locator("[data-island-stage]")).toHaveAttribute("data-overlay", "true");
  await expect.poll(() => page.locator('#writing [data-island-visual]').evaluate(node => getComputedStyle(node).animationPlayState.split(",").every(state => state.trim() === "paused"))).toBe(true);
  const firstId = await expectOriginalThought(dialog);
  expect(firstId).not.toBe(thoughts[0].id);
  await expect(dialog.getByRole("button", { name: /save|saved|copy link/i })).toHaveCount(0);
  const avatar = dialog.locator('[data-note-stack] > div:not([data-note-sheet]) img');
  await expect(avatar).toHaveAttribute("src", /x-profile\.jpg/);
  await expect.poll(() => avatar.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(dialog).toHaveAttribute("data-note-motion", "idle");
  const shuffle = dialog.getByRole("button", { name: "Shuffle thoughts" });
  await expect(shuffle).toBeVisible();
  const tapArea = (await shuffle.boundingBox())!;
  expect(tapArea.width).toBeGreaterThanOrEqual(44);
  expect(tapArea.height).toBeGreaterThanOrEqual(44);
  // Exercise the real touch target on phones and keyboard activation on desktop.
  if (isMobile) await shuffle.tap();
  else { await shuffle.focus(); await page.keyboard.press("Enter"); }
  const shuffledId = await expectOriginalThought(dialog);
  expect(shuffledId).not.toBe(firstId);
  await page.screenshot({ path: `/tmp/carter-thoughts-${testInfo.project.name}.png` });
  await dialog.getByRole("button", { name: "Next thought" }).click();
  expect(await expectOriginalThought(dialog)).not.toBe(shuffledId);
  await dialog.getByRole("button", { name: "Previous thought" }).click();
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", shuffledId);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-thought-cards]")).toBeFocused();
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-overlay");
  await openObject(page, "[data-thought-cards]", isMobile);
  expect(await expectOriginalThought(dialog)).not.toBe(shuffledId);
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

test("shared thoughts and shuffle work without storage, and removed promotional links fall back gracefully", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } });
  });
  await page.goto("/?thought=1944727397909279094#writing");
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", "1944727397909279094");
  await expect(dialog.getByRole("navigation", { name: "Thought collection" })).toHaveCount(0);
  await expect(dialog.getByText("Originally shared with a quoted post.", { exact: false })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "View the context on X" })).toHaveCount(0);
  await expectOriginalThought(dialog);
  await expect(dialog.locator('a:not([href^="https://x.com/"])')).toHaveCount(0);
  await dialog.getByRole("button", { name: "Shuffle thoughts" }).click();
  expect(await expectOriginalThought(dialog)).not.toBe("1944727397909279094");
  await dialog.getByRole("button", { name: "Close thoughts" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/#writing$/);
  await expect(page.locator("[data-thought-cards]")).toBeFocused();
  // An old shared link must never resurrect the removed Taipei Run launch post.
  await page.goto("/?thought=2104108558929502655#writing");
  await expect(dialog).toBeVisible();
  expect(await expectOriginalThought(dialog)).not.toBe("2104108558929502655");
  expect(errors).toEqual([]);
});

const longThought = "2037182514700185821";
const longIndex = thoughts.findIndex(thought => thought.id === longThought);
const articleId = (dialog: Locator) => dialog.locator("article").getAttribute("data-thought-id");

// Real touches on Chromium. WebKit has no touch injection in Playwright, so it
// gets the same pointer sequence as synthetic events.
async function swiper(page: Page, context: BrowserContext, browserName: string) {
  const session = browserName === "chromium" ? await context.newCDPSession(page) : null;
  const pointer = (type: string, x: number, y: number) => page.evaluate(([type, x, y]) => {
    const target = document.elementFromPoint(Number(x), Number(y)) ?? document.body;
    (window as unknown as { swipeTarget?: Element }).swipeTarget ??= target;
    (window as unknown as { swipeTarget: Element }).swipeTarget.dispatchEvent(new PointerEvent(String(type), { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: Number(x), clientY: Number(y) }));
    if (type === "pointerup") delete (window as unknown as { swipeTarget?: Element }).swipeTarget;
  }, [type, x, y]);
  const start = async (x: number, y: number) => session
    ? session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
    : pointer("pointerdown", x, y);
  const to = async (x: number, y: number) => session
    ? session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] })
    : pointer("pointermove", x, y);
  const end = async (x: number, y: number) => session
    ? session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    : pointer("pointerup", x, y);
  const swipe = async (x: number, y: number, dx: number, dy = 0) => {
    await start(x, y);
    for (let step = 1; step <= 8; step++) await to(x + dx * step / 8, y + dy * step / 8);
    await end(x + dx, y + dy);
  };
  return { start, to, end, swipe };
}

test("swiping a tweet turns to the next or previous one on touch screens", async ({ page, context, browserName, isMobile }) => {
  test.skip(!isMobile, "Touch only; the mouse case is covered separately.");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/?thought=${thoughts[0].id}#writing`);
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  await expect(dialog).toHaveAttribute("data-note-motion", "idle");
  const reader = dialog.locator("[data-note-stack] > div:not([data-note-sheet])");
  const box = (await reader.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const touch = await swiper(page, context, browserName);
  const settled = () => expect.poll(() => reader.evaluate(node => node.getAnimations().length === 0 && node.style.transform === "")).toBe(true);

  await touch.swipe(x + 80, y, -200);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", thoughts[1].id);
  await expectOriginalThought(dialog);
  await settled();
  await touch.swipe(x - 80, y, 200);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", thoughts[0].id);
  await settled();
  // The collection is a loop, matching the Previous button.
  await touch.swipe(x - 80, y, 200);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", thoughts[thoughts.length - 1].id);
  await settled();
  await touch.swipe(x + 80, y, -200);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", thoughts[0].id);
  await settled();

  // The card tracks the finger, and a slow short drag returns without paging.
  await touch.start(x, y);
  for (const dx of [-12, -24, -36]) await touch.to(x + dx, y);
  await expect.poll(() => reader.evaluate(node => Math.round(new DOMMatrix(getComputedStyle(node).transform).m41))).toBe(-36);
  await page.waitForTimeout(150);
  await touch.end(x - 36, y);
  await settled();
  expect(await articleId(dialog)).toBe(thoughts[0].id);

  // A second swipe during the first one's exit still counts.
  await touch.swipe(x + 80, y, -200);
  await touch.swipe(x + 80, y, -200);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", thoughts[2].id);
  await settled();

  // Starting on the X link drags the card rather than following the link.
  const link = (await dialog.getByRole("link", { name: "View on X", exact: true }).boundingBox())!;
  let opened = false;
  context.once("page", () => { opened = true; });
  await touch.swipe(link.x + link.width / 2, link.y + link.height / 2, -180);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", thoughts[3].id);
  await settled();
  expect(opened).toBe(false);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  expect(errors).toEqual([]);
});

test("a long tweet still scrolls vertically, and a pinch-zoomed reader pans instead of paging", async ({ page, context, browserName, isMobile }) => {
  test.skip(!isMobile || browserName !== "chromium", "Native gestures require mobile Chromium CDP.");
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto(`/?thought=${longThought}#writing`);
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  await expect(dialog).toHaveAttribute("data-note-motion", "idle");
  const scroller = dialog.getByLabel("Post content");
  expect(await scroller.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  const box = (await scroller.boundingBox())!;
  const touch = await swiper(page, context, browserName);
  await touch.swipe(box.x + box.width / 2, box.y + box.height - 20, 0, -120);
  await expect.poll(() => scroller.evaluate(node => node.scrollTop)).toBeGreaterThan(40);
  expect(await articleId(dialog)).toBe(longThought);

  // Sideways over the scrolling text pages too, and the next post starts at its top.
  await touch.swipe(box.x + box.width - 40, box.y + box.height / 2, -200);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", thoughts[(longIndex + 1) % thoughts.length].id);
  expect(await scroller.evaluate(node => node.scrollTop)).toBe(0);

  const session = await context.newCDPSession(page);
  const header = dialog.locator("[data-note-stack] > div:not([data-note-sheet]) header");
  const atRest = (await header.boundingBox())!;
  await session.send("Input.synthesizePinchGesture", { x: 195, y: atRest.y + atRest.height / 2, scaleFactor: 2, relativeSpeed: 800, gestureSourceType: "touch" });
  await expect.poll(() => page.evaluate(() => visualViewport!.scale)).toBeGreaterThan(1.9);
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  const zoomedId = await articleId(dialog);
  const panStart = await page.evaluate(() => visualViewport!.offsetLeft);
  const zoomed = (await header.boundingBox())!;
  await session.send("Input.synthesizeScrollGesture", { x: zoomed.x + zoomed.width / 2, y: zoomed.y + zoomed.height / 2, xDistance: -50, yDistance: 0, speed: 800, gestureSourceType: "touch" });
  await expect.poll(() => page.evaluate(() => visualViewport!.offsetLeft)).toBeGreaterThan(panStart + 20);
  expect(await articleId(dialog)).toBe(zoomedId);
});

test("dragging a tweet with a mouse selects text instead of paging", async ({ page, isMobile }) => {
  test.skip(isMobile, "Mouse input.");
  await page.goto(`/?thought=${thoughts[0].id}#writing`);
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  await expect(dialog).toHaveAttribute("data-note-motion", "idle");
  const box = (await dialog.locator("article").boundingBox())!;
  await page.mouse.move(box.x + box.width - 40, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 12, { steps: 8 });
  await page.mouse.up();
  expect(await articleId(dialog)).toBe(thoughts[0].id);
  expect(await dialog.locator("[data-note-stack] > div:not([data-note-sheet])").evaluate(node => node.style.transform)).toBe("");
  expect(await page.evaluate(() => getSelection()!.toString().length)).toBeGreaterThan(0);
});

test("the card behind a swipe is the real post being turned to", async ({ page, context, browserName, isMobile }) => {
  test.skip(!isMobile, "Swiping is touch only.");
  // A short post with a long one after it, so the page turn also changes the card's height.
  const start = thoughts.findIndex((thought, i) => thought.text.length < 300 && thoughts[i + 1]?.text.length > 900);
  const [current, next, previous] = [thoughts[start], thoughts[start + 1], thoughts[(start - 1 + thoughts.length) % thoughts.length]];
  await page.goto(`/?thought=${current.id}#writing`);
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  await expect(dialog).toHaveAttribute("data-note-motion", "idle");
  const reader = dialog.locator("[data-note-stack] > div:not([data-note-sheet])");
  const under = dialog.locator('[data-note-sheet="middle"]');
  const firstParagraph = (thought: { text: string }) => thought.text.split(/\n\s*\n/)[0];
  const box = (await reader.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  const touch = await swiper(page, context, browserName);

  // It's hidden from assistive tech and can't take focus: only the top card is live.
  await expect(under).toHaveAttribute("aria-hidden", "true");
  await expect(under.locator("article")).toHaveCount(0);

  // Dragging left shows the next post underneath, dragging right the previous one.
  await touch.start(x, y);
  await touch.to(x - 40, y);
  await expect(under.locator("p").first()).toHaveText(firstParagraph(next));
  await touch.to(x + 40, y);
  await expect(under.locator("p").first()).toHaveText(firstParagraph(previous));
  await touch.to(x - 400, y);
  await expect(under.locator("p").first()).toHaveText(firstParagraph(next));

  // Fully dragged, the card underneath already sits exactly where the top card will land.
  const beneath = (await under.boundingBox())!;
  const closeBefore = (await dialog.getByRole("button", { name: "Close thoughts" }).boundingBox())!;
  await touch.end(x - 400, y);
  await expect(dialog.locator("article")).toHaveAttribute("data-thought-id", next.id);
  await expect.poll(() => reader.evaluate(node => node.getAnimations().length)).toBe(0);
  const landed = (await reader.boundingBox())!;
  for (const side of ["x", "y", "width", "height"] as const) expect(Math.abs(landed[side] - beneath[side])).toBeLessThan(1);
  const closeAfter = (await dialog.getByRole("button", { name: "Close thoughts" }).boundingBox())!;
  expect(Math.abs(closeAfter.y - closeBefore.y)).toBeLessThan(1);
  // The post has been on screen all along, so it doesn't fade in again.
  expect(await dialog.locator("article").evaluate(node => getComputedStyle(node).opacity)).toBe("1");
  await expect.poll(() => under.evaluate(node => node.getAnimations().length)).toBe(0);
  expect(await under.evaluate(node => node.style.top + node.style.bottom)).toBe("");
});

test("the bird flies to the notes, the reader opens as it lands, and it flies home afterwards", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#writing");
  await expect(page.locator('#writing [data-island-visual]')).toHaveAttribute("data-parallax", "on", { timeout: 30_000 });
  const bird = page.locator("[data-thought-bird]");
  const flyer = page.locator("[data-bird-flyer]");
  const wing = flyer.locator("g > path").nth(5);
  const resting = await wing.getAttribute("d");
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  await page.evaluate(() => {
    const samples: { d: string; transform: string }[] = [];
    (window as unknown as { birdSamples: typeof samples }).birdSamples = samples;
    const tick = () => {
      const flyer = document.querySelector<SVGSVGElement>("[data-bird-flyer]");
      if (flyer?.style.transform) samples.push({ d: flyer.querySelectorAll("g > path")[5].getAttribute("d")!, transform: flyer.style.transform });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const stage = page.locator("[data-island-stage]");
  const stageY = await stage.evaluate(node => node.getBoundingClientRect().y);
  const pageY = await page.evaluate(() => scrollY);
  await openObject(page, "[data-thought-bird]", isMobile);
  await expect(bird).toHaveAttribute("data-flying", "");
  await expect(dialog).toBeVisible();
  // The scene stays put behind the reader rather than jumping out of view.
  expect(await stage.evaluate(node => node.getBoundingClientRect().y)).toBe(stageY);
  expect(await page.evaluate(() => scrollY)).toBe(pageY);
  // It really flew: many distinct wing shapes and positions on the way.
  const samples = await page.evaluate(() => (window as unknown as { birdSamples: { d: string; transform: string }[] }).birdSamples);
  expect(new Set(samples.map(sample => sample.d)).size).toBeGreaterThan(5);
  expect(new Set(samples.map(sample => sample.transform)).size).toBeGreaterThan(5);
  await dialog.getByRole("button", { name: "Close thoughts" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(bird).toBeFocused();
  await expect(bird).not.toHaveAttribute("data-flying", "", { timeout: 4000 });
  await expect(wing).toHaveAttribute("d", resting!);
  expect(await flyer.evaluate((node: SVGSVGElement) => node.style.transform)).toBe("");
  expect(errors).toEqual([]);
});

test("reduced motion opens the reader from the bird without a flight", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#writing");
  await expect(page.locator("[data-thought-bird]")).toBeVisible();
  await openObject(page, "[data-thought-bird]", isMobile);
  await expect(page.getByRole("dialog", { name: "Posts by Carter" })).toBeVisible();
  await expect(page.locator("[data-thought-bird]")).not.toHaveAttribute("data-flying", "");
  expect(await page.locator("[data-bird-flyer]").evaluate((node: SVGSVGElement) => node.style.transform)).toBe("");
});

test("focus rings show for keyboard users but not after tapping or clicking", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#writing");
  const bird = page.locator("[data-thought-bird]");
  await expect(bird).toBeVisible();
  const outline = (locator: Locator) => locator.evaluate(node => getComputedStyle(node).outlineStyle);
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  const closeButton = dialog.getByRole("button", { name: "Close thoughts" });
  if (isMobile) await bird.tap(); else await bird.click();
  await expect(closeButton).toBeFocused();
  expect(await outline(closeButton)).toBe("none");
  expect(await closeButton.evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  if (isMobile) await closeButton.tap(); else await closeButton.click();
  await expect(dialog).toHaveCount(0);
  await expect(bird).toBeFocused();
  expect(await outline(bird)).toBe("none");
  await expect(bird.locator("span")).toHaveCSS("opacity", "0");
  if (isMobile) return;
  // Tabbing brings the rings back.
  await page.keyboard.press("Enter");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();
  expect(await outline(closeButton)).toBe("solid");
  await page.keyboard.press("Escape");
  await expect(bird).toBeFocused();
  expect(await outline(bird)).toBe("solid");
});

test("a shared link opens the reader with no focus ring until Tab is pressed", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/?thought=${thoughts[0].id}#writing`);
  const closeButton = page.getByRole("dialog", { name: "Posts by Carter" }).getByRole("button", { name: "Close thoughts" });
  await expect(closeButton).toBeFocused();
  const outline = () => closeButton.evaluate(node => getComputedStyle(node).outlineStyle);
  expect(await outline()).toBe("none");
  if (isMobile) return;
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();
  expect(await outline()).toBe("solid");
});

test("the rocket cursor stays above the tweet reader, and hands back once it closes", async ({ page, isMobile }) => {
  test.skip(isMobile, "The rocket follows a mouse.");
  await page.goto(`/?thought=${thoughts[0].id}#writing`);
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
  await expect(dialog.locator("article")).toBeVisible();
  const box = (await dialog.locator("article").boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  const rocket = page.getByTestId("rocket-cursor");
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
  const rect = await rocket.evaluate(node => { const { x, y } = node.getBoundingClientRect(); return { x, y }; });
  expect(Math.abs(rect.x - x)).toBeLessThan(2);
  expect(Math.abs(rect.y - y)).toBeLessThan(2);
  // In the top layer, entered after the dialog, and still not in the pointer's way.
  await expect(rocket).toHaveJSProperty("popover", "manual");
  expect(await rocket.evaluate(node => node.matches(":popover-open"))).toBe(true);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-testid="rocket-cursor"]') ?? null, [x, y])).toBeNull();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await rocket.getAttribute("popover")).toBeNull();
  await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
  expect(await rocket.evaluate(node => getComputedStyle(node).display)).toBe("block");
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
  const dialog = page.getByRole("dialog", { name: "Posts by Carter" });
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
  const arcade = page.getByRole("dialog", { name: /Taipei Run/i });
  await expect(arcade).toBeVisible();
  await expect(arcade.getByRole("button", { name: "Close arcade" })).toBeFocused();
  await expect(arcade.getByText("Arcade session", { exact: true })).toHaveCount(0);
  const frame = arcade.locator("iframe");
  const screen = (await frame.boundingBox())!;
  if (!isMobile) {
    // The system cursor takes over inside the game, so the rocket mustn't wait at its edge.
    await page.mouse.move(screen.x - 12, screen.y + 40);
    await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
    await page.mouse.move(screen.x + screen.width / 2, screen.y + screen.height / 2, { steps: 4 });
    await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "0");
    await page.mouse.move(screen.x - 12, screen.y + 40);
    await expect(page.getByTestId("rocket-ship")).toHaveCSS("opacity", "1");
  }
  expect(screen.width).toBeGreaterThan(280);
  expect(screen.height).toBeGreaterThan(420);
  for (const control of await arcade.locator("button, a").all()) {
    const box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.frameLocator('iframe[title="Taipei Run game"]').getByRole("button", { name: "Start session" })).toBeVisible();
  await expect.poll(() => gameRequests).toBe(1);
  await expect.poll(() => page.locator("[data-background-video]").evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await arcade.getByRole("button", { name: "Reload game" }).click();
  await expect.poll(() => gameRequests).toBe(2);
  await expect(page.frameLocator('iframe[title="Taipei Run game"]').getByRole("button", { name: "Start session" })).toBeVisible();
  await page.frameLocator('iframe[title="Taipei Run game"]').getByRole("button", { name: "Start session" }).click();
  await expect(page.frameLocator('iframe[title="Taipei Run game"]').getByRole("button", { name: "Session started" })).toBeVisible();
  if (isMobile) {
    const originalSize = page.viewportSize()!;
    for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      const bounds = (await frame.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
      expect(bounds.height).toBeGreaterThan(260);
      for (const control of await arcade.locator("button, a").all()) {
        const box = (await control.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      }
    }
    await page.setViewportSize(originalSize);
  }
  // Escape belongs to the host dialog while its close control is focused.
  await arcade.getByRole("button", { name: "Close arcade" }).focus();
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
  const arcade = page.getByRole("dialog", { name: /Taipei Run/i });
  await expect(arcade).toBeVisible();
  await expect(arcade.getByText("Loading…")).toBeVisible();
  await expect(arcade.getByText("Still loading.")).toBeVisible({ timeout: 15_000 });
  await expect(arcade.getByRole("link", { name: "Open game", exact: true })).toHaveAttribute("href", "https://taipeirun.com/");
  await arcade.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.frameLocator('iframe[title="Taipei Run game"]').getByRole("button", { name: "Start session" })).toBeVisible();
  release?.();
  await arcade.getByRole("button", { name: "Close arcade" }).click();
  await expect(arcade).toHaveCount(0);
});
