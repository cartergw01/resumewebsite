import { expect, test } from "@playwright/test";

test("workshop screen and book pages respond locally to keyboard focus and hover", async ({ page }, testInfo) => {
  await page.goto("/2.0#projects");
  const screen = page.locator("[data-workshop-screen]");
  const workshop = page.locator("#projects [data-island-link]");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  await expect(screen).toHaveCSS("opacity", "0.3");
  await workshop.focus();
  await expect(screen).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Show Writing island" }).focus();
  await expect(screen).toHaveCSS("opacity", "0.3");
  if (testInfo.project.name === "desktop") {
    await workshop.hover();
    await expect(screen).toHaveCSS("opacity", "1");
    await page.mouse.move(4, 4);
  }
  await page.getByRole("button", { name: "Show Writing island" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await expect(page.locator("#writing [data-scene-copy]")).toHaveCSS("opacity", "1");
  const book = page.locator("#writing [data-island-link]");
  const edges = page.locator("[data-book-response] > g");
  // Establish keyboard modality after selecting a world with the pointer.
  await page.keyboard.press("Tab");
  await book.focus();
  await expect(book).toBeFocused();
  await expect(edges).toHaveCSS("opacity", "0.85");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(edges).toHaveCSS("transform", "none");
  expect(await edges.evaluate(node => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThan(0.001);
});

test("one screen travels from the workshop into the first real project", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/2.0#projects");
  const source = page.locator("[data-workshop-screen]");
  const src = await source.getAttribute("href");
  await page.locator("#projects [data-island-link]").click();
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  const carry = page.locator("body > [data-workshop-transition]");
  await expect(carry).toHaveAttribute("data-workshop-transition", "entering");
  await expect(carry.locator("img")).toHaveAttribute("src", src!);
  await carry.evaluate(node => node.setAttribute("data-same-screen", "true"));
  await expect(page).toHaveURL(/\/projects$/);
  await expect(carry).toHaveAttribute("data-workshop-transition", "arriving");
  await expect(carry).toHaveAttribute("data-same-screen", "true");
  await expect(page.locator("[data-project-screen] img")).toHaveAttribute("src", src!);
  await expect(carry).toHaveCount(0);
  await expect(page.locator("[data-project-screen]")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open TaipeiFlix live project in a new tab" })).toBeFocused();
  await expect(page.locator('img[src="/world-projects-workshop-v4.webp"]')).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-workshop-transition");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Back to islands" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  expect(errors).toEqual([]);
});

test("reduced motion and direct entry show the complete project without a transition layer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0#projects");
  await page.locator("#projects [data-island-link]").click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator("body > [data-workshop-transition]")).toHaveCount(0);
  await expect(page.locator("[data-project-screen]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-project-screen]")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open .* live project/ })).toHaveCount(8);
});
