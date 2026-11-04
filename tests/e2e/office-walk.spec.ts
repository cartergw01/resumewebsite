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
