import { expect, test } from "@playwright/test";
import { expectRocketLaunched, watchRocketLaunch } from "./rocket-launch";

test("workshop screen and book pages respond locally to keyboard focus and hover", async ({ page }, testInfo) => {
  await page.goto("/#projects");
  const screen = page.locator("#projects [data-workshop-screen]");
  const workshop = page.locator("#projects [data-island-link]");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  // The monitor shows its project at full brightness, at rest and in focus.
  await expect(screen).toHaveCSS("opacity", "1");
  await workshop.focus();
  await expect(screen).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Show Writing island" }).focus();
  await expect(screen).toHaveCSS("opacity", "1");
  if (testInfo.project.name === "desktop") {
    await workshop.hover();
    await expect(screen).toHaveCSS("opacity", "1");
    await page.mouse.move(4, 4);
  }
  await page.getByRole("button", { name: "Show Writing island" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "writing");
  await expect(page.locator("#writing [data-scene-copy]")).toHaveCSS("opacity", "1");
  const book = page.locator("#writing [data-island-link]");
  const spread = page.locator("#writing [data-book-spread]");
  // Establish keyboard modality after selecting a world with the pointer.
  await page.keyboard.press("Tab");
  await book.focus();
  await expect(book).toBeFocused();
  await expect(spread).toHaveAttribute("data-essays", /The Cost of Keeping Up/);
  await expect(page.locator("[data-book-response]")).toHaveCount(0);
});

test("the workshop screen fans out every project and deals each into its row", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#projects");
  const source = page.locator("#projects [data-workshop-screen]");
  const src = await source.getAttribute("data-src");
  // The decorative launch comes from a deferred component on both input types.
  await expect(page.locator("html")).toHaveAttribute("data-rocket-transition", "idle");
  await watchRocketLaunch(page);
  const island = page.locator("#projects [data-island-link]");
  if (isMobile) await island.tap(); else await island.click();
  await expectRocketLaunched(page);
  const carry = page.locator("body > [data-workshop-transition]");
  await expect(carry).toHaveAttribute("data-workshop-transition", "entering");
  // The arrival can finish between assertions on a phone. Observe the handoff
  // when it happens, including the identity of the carried screen.
  await carry.evaluate(node => {
    node.setAttribute("data-same-screen", "true");
    const observer = new MutationObserver(() => {
      if (node.getAttribute("data-workshop-transition") !== "arriving") return;
      (window as Window & { workshopArrival?: object }).workshopArrival = {
        same: node.getAttribute("data-same-screen") === "true",
        connected: node.isConnected,
        route: location.pathname,
      };
      observer.disconnect();
    });
    observer.observe(node, { attributes: true, attributeFilter: ["data-workshop-transition"] });
  });
  // A deck of every project, the monitor's own screen on top, all one size.
  const cards = carry.locator("[data-project-card]");
  await expect(cards).toHaveCount(8);
  await expect(carry.locator('[data-project-card="0"] img')).toHaveAttribute("src", src!);
  await expect(cards.last()).toHaveAttribute("data-project-card", "0");
  expect(new Set(await cards.evaluateAll(nodes => nodes.map(node => `${(node as HTMLElement).offsetWidth}x${(node as HTMLElement).offsetHeight}`))).size).toBe(1);
  await expect(page).toHaveURL(/\/projects$/);
  await expect.poll(() => page.evaluate(() => (window as Window & { workshopArrival?: object }).workshopArrival)).toEqual({same:true, connected:true, route:"/projects"});
  await expect(page.locator("[data-project-screen] img")).toHaveAttribute("src", src!);
  await expect(carry).toHaveCount(0);
  await expect(page.locator("[data-project-screen]")).toBeVisible();
  await expect(page.locator("[data-project-shot]")).toHaveCount(8);
  await expect(page.getByRole("link", { name: "Open TaipeiFlix live project in a new tab" })).toBeFocused();
  await expect(page.locator('img[src^="/blender/island-projects-"]')).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-workshop-transition");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goBack();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  expect(errors).toEqual([]);
});

test("reduced motion and direct entry show the complete project without a transition layer", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#projects");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  // A tap during the hash link's glide stops the glide instead of entering.
  const stage = page.locator("[data-island-stage]");
  await expect(stage).not.toHaveAttribute("data-navigating");
  await expect(stage).not.toHaveAttribute("data-scrolling");
  // Tap where the island is, as a finger would. Playwright's click first
  // scrolls the link "into view", which in this pinned stage scrolls the page
  // back toward Writing and, with reduced motion, swaps the island away.
  const island = (await page.locator("#projects [data-island-link]").boundingBox())!;
  const [x, y] = [island.x + island.width / 2, island.y + island.height / 2];
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator("body > [data-workshop-transition]")).toHaveCount(0);
  await expect(page.locator("[data-project-screen]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-project-screen]")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open .* live project/ })).toHaveCount(8);
});
