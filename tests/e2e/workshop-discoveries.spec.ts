import { expect, test } from "@playwright/test";

// Only things that open something real are clickable on the projects island:
// the project objects, the shield and the light stick. The rest are scenery.
test("only the shield, light stick and project objects are clickable on the island", async ({ page }) => {
  await page.goto("/#projects");
  await expect(page.locator("#projects [data-workshop-object]")).toHaveCount(3);
  await expect(page.locator("[data-curio]")).toHaveCount(2);
  await expect(page.locator('[data-curio="shield"]')).toHaveAccessibleName("Read the Declaration of Independence");
  await expect(page.locator('[data-curio="lightstick"]')).toHaveAttribute("href", "https://www.youtube.com/watch?v=gQlMMD8auMs");
  await expect(page.locator('[data-curio="lightstick"]')).toHaveAttribute("target", "_blank");
  // Each prop's marker must receive the tap, not a neighbour or the island.
  const blocked = await page.locator("[data-curio]").evaluateAll(nodes => nodes.flatMap(node => {
    const pin = node.querySelector("span")!.getBoundingClientRect();
    return node.contains(document.elementFromPoint(pin.x, pin.y)) ? [] : [node.getAttribute("data-curio")];
  }));
  expect(blocked).toEqual([]);
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
  expect(await layer.evaluate(node => (node as HTMLElement).innerText.trim())).toBe("");
});
