import { expect, test } from "@playwright/test";

// Only things that open something real are clickable on the projects island:
// the project objects and the shield. The rest of the props are scenery.
test("only the shield and project objects are clickable on the island", async ({ page }) => {
  await page.goto("/#projects");
  await expect(page.locator("#projects [data-workshop-object]")).toHaveCount(5);
  await expect(page.locator("[data-curio]")).toHaveCount(1);
  await expect(page.locator('[data-curio="shield"]')).toHaveAccessibleName("Read the Declaration of Independence");
  await expect(page.getByRole("button", { name: /^Pick up / })).toHaveCount(0);
  await expect(page.locator("dialog[data-discovery]")).toHaveCount(0);
});

test("island objects carry no name labels, even after the shield closes", async ({ page }) => {
  await page.goto("/#projects");
  const layer = page.locator("[data-workshop-objects]");
  await expect(layer.locator('[data-curio="shield"]')).toBeVisible();
  await expect(layer.locator("[data-tip]")).toHaveCount(0);
  await layer.locator('[data-curio="shield"]').evaluate((node: HTMLElement) => node.click());
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(layer.locator('[data-curio="shield"]')).toBeFocused();
  // Nothing in the layer shows text: names live only in accessible labels.
  expect(await layer.evaluate(node => node.innerText.trim())).toBe("");
});
