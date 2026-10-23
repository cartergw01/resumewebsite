import { expect, test } from "@playwright/test";

test("Taipei switches between night and day, remembers it, and still enters Work", async ({ page }) => {
  await page.goto("/#work");
  const toggle = page.getByRole("switch", { name: "Taipei daylight" });
  await expect(toggle).toBeVisible();
  // The caption reads "night" until the city is switched to "day".
  await expect(toggle.locator('[data-label="off"]')).toHaveText("night");
  await expect(toggle.locator('[data-label="off"]')).toHaveCSS("opacity", "1");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  // Daylight uses the same explicit on/off control as the room lights.
  await expect(toggle).toHaveAttribute("data-time", "night");
  // The day still only loads once someone reaches for the switch.
  const day = page.locator('#work img[data-city-time="day"]');
  await expect(day).toHaveCount(0);
  await toggle.click();
  await expect(day).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("data-city-time", "day");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page).toHaveURL(/\/#work$/);
  await expect(page.getByRole("switch", { name: "Taipei daylight" })).toHaveAttribute("data-time", "day");
  // Either the day still is showing, or the depth-parallax canvas (which draws
  // the day image itself) has taken over from the stills.
  await expect.poll(() => day.evaluate(node => node.parentElement!.dataset.parallax === "on" || getComputedStyle(node).opacity === "1")).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-city-time", "day");
  await page.getByRole("link", { name: /^Work,/ }).click();
  await expect(page).toHaveURL(/\/work$/, { timeout: 15_000 });
  await page.goto("/#work");
  await page.getByRole("switch", { name: "Taipei daylight" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-city-time", "day");
});
