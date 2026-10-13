import { expect, test, type Page } from "@playwright/test";
import { ENTRY_APPROACH_DURATION } from "../../lib/island-entry-motion";

// Hold every animation of the entry once it starts, so assertions can sample
// the push and dissolve at exact points of the shared clock.
async function holdEntry(page: Page) {
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector("body > [data-work-transition]")) return;
      observer.disconnect();
      const held = document.getAnimations().filter(animation => animation.playState === "running");
      held.forEach(animation => animation.pause());
      (window as Window & { held?: Animation[] }).held = held;
    });
    observer.observe(document.body, { childList: true });
  });
}
const at = (page: Page, progress: number) => page.evaluate(([progress, ENTRY_APPROACH_DURATION]) => {
  const held = (window as Window & { held?: Animation[] }).held ??= [];
  // The letters' flight is built a moment after the tap: hold it too.
  for (const animation of document.getAnimations()) {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    if (!held.includes(animation) && target?.closest("body > [data-work-transition]")) { animation.pause(); held.push(animation); }
  }
  for (const animation of held) {
    animation.currentTime = Math.min(Number(animation.effect!.getComputedTiming().endTime), progress * ENTRY_APPROACH_DURATION);
  }
}, [progress, ENTRY_APPROACH_DURATION] as const);
const scaleOf = (page: Page) => page.locator("#work [data-island-visual]").evaluate(visual => {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(visual).transform);
  return Math.hypot(matrix.a, matrix.b);
});

test("Work pushes in on its sharp render and dissolves into the same page", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  const link = page.locator("#work [data-island-link]");
  // Intent fetches the full render the push lands on (on phones, a 2048px
  // rendition of it).
  const full = page.waitForResponse(response => {
    const url = new URL(response.url());
    return /\/blender\/island-work-[0-9a-f]+\.webp$/.test(url.pathname) || /^\/blender\/island-work-[0-9a-f]+\.webp$/.test(url.searchParams.get("url") ?? "");
  });
  await link.focus();
  await full;
  await page.waitForTimeout(300);
  await holdEntry(page);
  await page.keyboard.press("Enter");
  const carry = page.locator("body > [data-work-transition]");
  await expect(carry).toHaveAttribute("data-time", "night");
  await expect(page.locator("#work [data-island-visual] > img[data-work-sharp]")).toHaveCount(1);
  // A calm push: close on the tower without magnifying past the render.
  await at(page, .5);
  const middle = await scaleOf(page);
  expect(middle).toBeGreaterThan(1.3);
  await at(page, 1);
  const final = await scaleOf(page);
  expect(final).toBeGreaterThan(middle);
  expect(final).toBeLessThan(5.5);
  // Taipei 101 spells the heading down its floors before the letters fly.
  const letters = page.locator("#work [data-tower-letter]");
  await expect(letters).toHaveText(["W", "o", "r", "k"]);
  await at(page, .45);
  for (const letter of await letters.all()) expect(Number(await letter.evaluate(node => getComputedStyle(node).opacity))).toBeGreaterThan(.9);
  // The words arrive only after the city has dimmed into the page's dark.
  await at(page, .55);
  expect(Number(await carry.locator("[data-work-preview]").evaluate(node => getComputedStyle(node).opacity))).toBeLessThan(.05);
  await at(page, 1);
  await expect(carry.locator("[data-work-preview]")).toHaveCSS("opacity", "1");
  // The letters land on the heading's own letters.
  await expect(carry.locator(":scope > span")).toHaveCount(4);
  const misses = await carry.evaluate(overlay => {
    const text = overlay.querySelector("[data-work-preview] h1")!.firstChild!;
    const range = document.createRange();
    return Array.from(overlay.querySelectorAll<HTMLElement>(":scope > span"), (glyph, index) => {
      range.setStart(text, index); range.setEnd(text, index + 1);
      const target = range.getBoundingClientRect(), box = glyph.getBoundingClientRect();
      return Math.max(Math.abs(box.left - target.left), Math.abs(box.top - target.top), Math.abs(box.width - target.width));
    });
  });
  for (const miss of misses) expect(miss).toBeLessThan(1);
  const preview = (await carry.locator("h1").boundingBox())!;
  // Resume the journey from where it was held. play() on an animation held
  // at its end would rewind it to the start (auto-rewind), so finish those.
  await page.evaluate(() => (window as Window & { held?: Animation[] }).held!.forEach(animation => {
    const end = Number(animation.effect!.getComputedTiming().endTime);
    if (Number.isFinite(end) && Number(animation.currentTime) >= end) animation.finish(); else animation.play();
  }));
  await expect(page).toHaveURL(/\/work$/);
  await expect(carry).toHaveCount(0);
  const heading = page.getByRole("heading", { name: "Work", exact: true, level: 1 });
  await expect(heading).toBeFocused();
  const destination = (await heading.boundingBox())!;
  expect(Math.abs(preview.x - destination.x)).toBeLessThan(1);
  expect(Math.abs(preview.y - destination.y)).toBeLessThan(1);
  expect(Math.abs(preview.width - destination.width)).toBeLessThan(1);
  await expect(page.locator("html")).not.toHaveAttribute("data-work-transition");
  await page.goBack();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  expect(errors).toEqual([]);
});

test("a turned 3D view settles back into its render, and Escape restores it", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/#work");
  const link = page.locator("#work [data-island-link]");
  await link.focus();
  await expect(page.locator('[data-island-orbit="work"]')).toHaveAttribute("data-orbit-ready", "true", { timeout: 60_000 });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const visual = page.locator("#work [data-island-visual]");
  await expect(visual).toHaveAttribute("data-orbit-live", "true");
  await holdEntry(page);
  await page.keyboard.press("Enter");
  await expect(visual).toHaveAttribute("data-entry-still", "true");
  // The render shows beneath the turned view, which fades away early.
  await expect(visual.locator("> img:not([data-city-time]):not([data-work-sharp])")).toHaveCSS("opacity", "1");
  await at(page, .35);
  await expect(page.locator('[data-island-orbit="work"]')).toHaveCSS("opacity", "0");
  await page.keyboard.press("Escape");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(visual).not.toHaveAttribute("data-entry-still");
  await expect(visual.locator("> img[data-work-sharp]")).toHaveCount(0);
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
});

test("an immediate Work entry needs no 3D download", async ({ page }) => {
  await page.route("**/orbit-*.glb", route => route.abort());
  await page.goto("/#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await expect(page.locator("#work [data-island-link]")).toBeVisible();
  await page.locator("#work [data-island-link]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(1);
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Work", exact: true, level: 1 })).toBeFocused();
});

test("Escape cancels the camera, restores the island, and permits another entry", async ({ page }) => {
  await page.goto("/#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  const heading = page.locator("#work-heading a");
  await heading.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.locator("[data-island-stage]")).not.toHaveAttribute("data-entering");
  await expect(page).toHaveURL(/\/#work$/);
  await expect(page.getByTestId("rocket-cursor")).toHaveAttribute("data-transition-phase", "idle");
  await expect(page.locator("#work [data-island-visual] > img:not([data-city-time])")).toBeVisible();
  await heading.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Work", exact: true, level: 1 })).toBeFocused();
});

test("direct and reduced-motion Work entries remain complete and immediately usable", async ({ page }) => {
  await page.goto("/work");
  await expect(page.getByRole("heading", { name: "Work", exact: true, level: 1 })).toBeVisible();
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#work");
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
  await page.goto("/#work");
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "work");
  await page.locator("#work [data-island-link]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator("body > [data-work-transition]")).toHaveCount(0);
  await expect(page.locator("[data-work-arrival]")).toBeVisible();
});
