import { expect, test } from "@playwright/test";

test("Taipei switches between night and day, remembers it, and still enters Work", async ({ page }) => {
  await page.goto("/2.0#work");
  const toggle = page.getByRole("button", { name: "Show Taipei in the day" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const day = page.locator('#work img[data-city-time="day"]');
  await expect(day).toHaveCount(1);
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-city-time", "day");
  await expect(page).toHaveURL(/\/2\.0#work$/);
  await expect(page.getByRole("button", { name: "Show Taipei at night" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => day.evaluate(node => getComputedStyle(node).opacity)).toBe("1");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-city-time", "day");
  await page.getByRole("link", { name: /Enter Work island/ }).click();
  await expect(page).toHaveURL(/\/work$/, { timeout: 15_000 });
  await page.goto("/2.0#work");
  await page.getByRole("button", { name: "Show Taipei at night" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-city-time", "day");
});
