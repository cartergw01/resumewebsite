import { expect, type Page } from "@playwright/test";

// The island deliberately floats. Native input at its visible marker avoids
// Playwright waiting forever for a motionless box or scrolling the pinned stage.
export async function pickUp(page: Page, id: string) {
  const object = page.locator(`[data-curio="${id}"]`);
  await expect(object).toBeVisible();
  const marker = (await object.locator(":scope > span").boundingBox())!;
  if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches)) {
    await page.touchscreen.tap(marker.x, marker.y);
  } else await page.mouse.click(marker.x, marker.y);
  await expect(page.locator("dialog[data-discovery]")).toHaveAttribute("data-discovery", id);
}
