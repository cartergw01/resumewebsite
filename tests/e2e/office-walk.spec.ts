import { expect, test } from "@playwright/test";

const worker = '[data-office-explorer] [class*="worker"]';
const place = (page: import("@playwright/test").Page) => page.locator(worker).evaluate((node: HTMLElement) => node.style.transform);

test("arrow keys walk him through the office and the story follows", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Arrow keys need a keyboard.");
  await page.goto("/work");
  const explorer = page.locator("[data-office-explorer]");
  await expect(explorer).toHaveAttribute("data-selected", "now");
  const hold = async (key: string, ms: number) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(60); };

  // Keys do nothing until the page has hydrated, which a cold dev build can delay.
  const start = await place(page);
  await expect(async () => {
    await hold("ArrowDown", 120);
    expect(await place(page)).not.toBe(start);
  }).toPass({ timeout: 20_000 });

  // The desk stops him.
  await hold("ArrowUp", 900);
  const atDesk = await place(page);
  await hold("ArrowUp", 300);
  expect(await place(page)).toBe(atDesk);

  // Out of the door, along the corridor and into the Slug Fund room.
  await hold("ArrowDown", 800);
  await hold("ArrowRight", 1100);
  await hold("ArrowDown", 1000);
  await expect(explorer).toHaveAttribute("data-selected", "slug");
  await expect(page.getByRole("heading", { name: "Slug Fund Investment Group" })).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);

  // A click still sends him by the doors, from wherever he has got to.
  await page.getByRole("button", { name: "Contrary Research" }).click();
  await expect(explorer).toHaveAttribute("data-selected", "research");
  await expect(page.getByRole("heading", { name: "Contrary Research" })).toBeVisible();
  await expect(page.locator(worker)).toHaveAttribute("data-walking", "false", { timeout: 3000 });

  // Standing at an object, Enter opens the link the copy has for it.
  const [profile] = await Promise.all([page.context().waitForEvent("page"), page.keyboard.press("Enter")]);
  expect(profile.url()).toContain("research.contrary.com/company/turo");
  await profile.close();
});
