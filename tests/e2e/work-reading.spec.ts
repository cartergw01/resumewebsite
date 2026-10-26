import { expect, test } from "@playwright/test";

test("Work navigation clears the text while reading and remains reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The reading dock is only used on phones.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/work");
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  const writing = navigation.getByRole("link", { name: "Writing", exact: true });
  await expect(navigation).toBeInViewport({ ratio: 1 });

  await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
  await expect(navigation).not.toBeInViewport();
  await expect(navigation).toHaveCSS("opacity", "0");

  await page.evaluate(() => window.scrollBy({ top: -60, behavior: "instant" }));
  await expect(navigation).toBeInViewport({ ratio: 1 });
  await expect(writing).toHaveAttribute("href", "/writing");

  await page.evaluate(() => window.scrollBy({ top: 100, behavior: "instant" }));
  await expect(navigation).not.toBeInViewport();
  // Keyboard focus must reveal the dock even while the reading state is tucked.
  await writing.focus();
  await expect(writing).toBeFocused();
  await expect(navigation).toBeInViewport({ ratio: 1 });
  await expect(navigation).toHaveCSS("opacity", "1");
  await writing.evaluate(node => (node as HTMLElement).blur());
  await expect(navigation).not.toBeInViewport();

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect(navigation).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("navigation", { name: "Contact", exact: true })).toBeInViewport({ ratio: 1 });
  await writing.click();
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.getByRole("heading", { level: 1, name: "Writing", exact: true })).toBeVisible();
});
