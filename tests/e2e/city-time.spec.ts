import { expect, test } from "@playwright/test";

test("Taipei switches between night and day, remembers it, and still enters Work", async ({ page }) => {
  await page.goto("/#work");
  const toggle = page.getByRole("button", { name: "Show Taipei in the day" });
  await expect(toggle).toBeVisible();
  // At night the single button offers the day (a sun), and vice versa.
  await expect(toggle).toHaveAttribute("data-time", "night");
  // The day still only loads once someone reaches for the switch.
  const day = page.locator('#work img[data-city-time="day"]');
  await expect(day).toHaveCount(0);
  await toggle.click();
  await expect(day).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("data-city-time", "day");
  await expect(page).toHaveURL(/\/#work$/);
  await expect(page.getByRole("button", { name: "Show Taipei at night" })).toHaveAttribute("data-time", "day");
  // Either the day still is showing, or the depth-parallax canvas (which draws
  // the day image itself) has taken over from the stills.
  await expect.poll(() => day.evaluate(node => node.parentElement!.dataset.parallax === "on" || getComputedStyle(node).opacity === "1")).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-city-time", "day");
  await page.getByRole("link", { name: /^Work,/ }).click();
  await expect(page).toHaveURL(/\/work$/, { timeout: 15_000 });
  await page.goto("/#work");
  await page.getByRole("button", { name: "Show Taipei at night" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-city-time", "day");
});
