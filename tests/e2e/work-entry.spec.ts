import { expect, test } from "@playwright/test";

test("Work carries its lit window into the page and lands the spark on Taipei", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    // Hold the brief docking animation when it is created, before Playwright
    // can miss it while recording a Retina video or waiting for the route.
    const observer = new MutationObserver(() => {
      const spark = document.querySelector("[data-work-arrival-spark]");
      const animation = spark?.getAnimations()[0];
      if (animation) { animation.pause(); observer.disconnect(); }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await page.locator("#work [data-island-link]").click();
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "launching");
  const carry = page.locator("body > [data-work-transition]");
  await expect(carry).toHaveAttribute("data-work-transition", "entering");
  await expect(carry.locator("[data-city-window]")).toHaveCount(1);
  await expect(carry.locator("h1")).toHaveText("Work");
  await expect(carry.locator("h3")).toHaveText("886 Studios");
  await carry.evaluate(node => node.setAttribute("data-carried-window", "true"));
  await expect(page).toHaveURL(/\/work$/);
  await expect(carry).toHaveAttribute("data-carried-window", "true");
  await expect(carry).toHaveAttribute("data-work-transition", "arriving");
  const spark = carry.locator("[data-work-arrival-spark]");
  await expect(spark).toHaveCount(1);
  // Pause just before docking and compare the actual screen coordinates to
  // the destination's tower light on each responsive layout.
  const gap = await spark.evaluate((node: HTMLElement) => {
    const flight = node.getAnimations()[0];
    flight.pause();
    flight.currentTime = Number(flight.effect!.getComputedTiming().endTime) - 1;
    const from = node.getBoundingClientRect();
    const to = document.querySelector("[data-work-arrival] [data-work-spark-target]")!.getBoundingClientRect();
    return Math.hypot(from.x + from.width / 2 - to.x - to.width / 2, from.y + from.height / 2 - to.y - to.height / 2);
  });
  expect(gap).toBeLessThan(2);
  await spark.evaluate(node => node.getAnimations().forEach(animation => animation.play()));
  await expect(carry).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-work-transition");
  await expect(page.getByRole("heading", { name: "Work", exact: true, level: 1 })).toBeFocused();
  await expect(page.getByRole("heading", { name: "886 Studios", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goBack();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  expect(errors).toEqual([]);
});

test("Escape cancels the approach; heading activation can retry and skip the arrival", async ({ page }) => {
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  const heading = page.locator("#work-heading a");
  await heading.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  await expect(page).toHaveURL(/\/2\.0#work$/);
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
  await heading.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator("html")).toHaveAttribute("data-work-transition", "arriving");
  await page.keyboard.press("Escape");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Work", exact: true, level: 1 })).toBeFocused();
});

test("direct and reduced-motion Work entries remain complete and immediately usable", async ({ page }) => {
  await page.goto("/work");
  await expect(page.getByRole("heading", { name: "Work", exact: true, level: 1 })).toBeVisible();
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await expect(page.locator("#work [data-scene-copy]")).toHaveCSS("opacity", "1");
  // WebKit can paint the scene's children a frame after its active state.
  await expect(page.locator("#work [data-island-link]")).toBeVisible();
  await page.locator("#work [data-island-link]").focus();
  await expect(page.locator("#work [data-island-link]")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "886 Studios", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-work-arrival]")).toBeVisible();
});

test("changing the motion preference during the approach skips cleanly to Work", async ({ page }) => {
  await page.goto("/2.0#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await page.locator("#work [data-island-link]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.locator("[data-work-arrival]")).toBeVisible();
});
