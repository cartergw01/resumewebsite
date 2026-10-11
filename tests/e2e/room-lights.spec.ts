import { expect, test } from "@playwright/test";

for (const [world, room] of [["writing", "study"], ["projects", "workshop"]] as const) {
  test(`the ${room} light switch turns its lights off and on, and is remembered`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/#${world}`);
    await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", world);
    const html = page.locator("html");
    const lightsSwitch = page.getByRole("button", { name: `Turn the ${room} lights off` });
    await expect(lightsSwitch).toHaveAttribute("aria-pressed", "true");
    await lightsSwitch.click();
    // The lights-off still is fetched on intent and crossfades in.
    await expect(html).toHaveAttribute(`data-${world}-lights`, "off");
    await expect(page.locator(`img[data-lights-off="${world}"]`)).toHaveCount(1);
    const onSwitch = page.getByRole("button", { name: `Turn the ${room} lights on` });
    await expect(onSwitch).toHaveAttribute("aria-pressed", "false");
    // Each room has its own switch: the other room stays lit.
    const other = world === "writing" ? "projects" : "writing";
    await expect(html).not.toHaveAttribute(`data-${other}-lights`, "off");
    // Remembered between visits.
    await page.reload();
    await expect(html).toHaveAttribute(`data-${world}-lights`, "off");
    await expect(page.getByRole("button", { name: `Turn the ${room} lights on` })).toBeVisible();
    await page.getByRole("button", { name: `Turn the ${room} lights on` }).click();
    await expect(html).not.toHaveAttribute(`data-${world}-lights`, "off");
    expect(errors).toEqual([]);
  });
}
