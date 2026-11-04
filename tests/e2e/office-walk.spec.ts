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

test("arrow keys walk him through the office and the story follows", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Arrow keys need a keyboard.");
  test.setTimeout(90_000);
  await page.goto("/work");
  const explorer = page.locator("[data-office-explorer]");
  await expect(explorer).toHaveAttribute("data-selected", "now");

  // Keys do nothing until the page has hydrated, which a cold dev build can delay.
  const start = await feet(page);
  await expect(async () => {
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(150);
    await page.keyboard.up("ArrowDown");
    expect((await feet(page)).y).toBeGreaterThan(start.y);
  }).toPass({ timeout: 30_000 });

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
  await expect(page.getByRole("heading", { name: "Slug Fund Investment Group" })).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);

  // A click still sends him by the doors, from wherever he has got to.
  await page.getByRole("button", { name: "Contrary Research" }).click();
  await expect(explorer).toHaveAttribute("data-selected", "research");
  await expect(page.getByRole("heading", { name: "Contrary Research" })).toBeVisible();
  await expect(page.locator(worker)).toHaveAttribute("data-walking", "false", { timeout: 5000 });

  // Standing at an object, Enter opens the link the copy has for it.
  const [profile] = await Promise.all([page.context().waitForEvent("page"), page.keyboard.press("Enter")]);
  expect(profile.url()).toContain("research.contrary.com/company/turo");
  await profile.close();
});
