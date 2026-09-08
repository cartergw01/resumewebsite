import { expect, test } from "@playwright/test";

test("the rooftop preview has its own route and leaves the published homepage intact", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("#hero-title")).toHaveText("Carter Wang");
  await expect(page.locator("#constellation")).toBeAttached();
  await expect(page.locator("#home-title")).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://carterkowang.com");

  await page.goto("/new");
  await expect(page.locator("#home-title")).toHaveText("Carter Wang");
  await expect(page.locator("#constellation")).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://carterkowang.com/new");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const essays = page.getByRole("region", { name: "Essay bookshelf" }).getByRole("link");
  await expect(essays).toHaveCount(11);
  await expect(page.getByRole("list", { name: "Project gallery" }).getByRole("link")).toHaveCount(8);
  await essays.first().focus();
  await expect(essays.first()).toHaveAttribute("href", "https://carterko.substack.com/p/the-cost-of-keeping-up");
  await expect.poll(() => essays.first().locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const workLink = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Work", exact: true });
  await workLink.click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.getByRole("heading", { name: "Carter Wang", exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
