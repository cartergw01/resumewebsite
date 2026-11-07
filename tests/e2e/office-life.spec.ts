import { expect, test, type Page } from "@playwright/test";

const life = "[data-office-life]";
const worker = '[data-office-explorer] [class*="worker"]';

async function enter(page: Page, name: string, mobile: boolean) {
  // The static production page can appear before the room controls hydrate.
  await expect(page.locator(life)).toHaveAttribute("data-running", "true");
  const room = page.getByRole("button", { name, exact: true });
  if (mobile) {
    const bounds = (await room.boundingBox())!;
    await room.tap({ position: { x: bounds.width / 2, y: bounds.height * (name === "886 Studios" ? 76 / 112 : .85) } });
  }
  else { await page.keyboard.press("Tab"); await room.focus(); await page.keyboard.press("Enter"); }
  await expect(room).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(worker)).toHaveAttribute("data-walking", "false", { timeout: 8000 });
}

async function face(page: Page, direction: "up" | "down", mobile: boolean) {
  if (mobile) {
    const key = page.locator(`[data-key="${direction}"]`);
    const bounds = (await key.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.up();
  } else {
    await page.keyboard.down(direction === "up" ? "ArrowUp" : "ArrowDown");
    await page.waitForTimeout(100);
    await page.keyboard.up(direction === "up" ? "ArrowUp" : "ArrowDown");
  }
}

test("occupied rooms react, screens wake when approached, and turning away rests them", async ({ page }, info) => {
  const mobile = info.project.name.startsWith("mobile");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/work");
  await expect(page.locator(life)).toHaveAttribute("data-running", "true");
  await enter(page, "886 Studios", mobile);
  await face(page, "up", mobile);
  await expect(page.locator(life)).toHaveAttribute("data-attention", "desk");
  await face(page, "down", mobile);
  await expect(page.locator(life)).toHaveAttribute("data-attention", "");
  await face(page, "up", mobile);
  await expect(page.locator(life)).toHaveAttribute("data-attention", "desk");

  await enter(page, "Building ikigai Launchpad", mobile);
  await expect(page.locator(life)).toHaveAttribute("data-room", "accelerator");
  await expect(page.locator(`${life} [class*="presentationBar"]`)).toHaveCount(4);
  await expect(page.locator(`${life} [class*="steam"]`)).toHaveCount(0);
  await expect.poll(() => page.locator(life).evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);

  await enter(page, "Finding founders", mobile);
  await expect(page.locator(life)).toHaveAttribute("data-room", "founders");
  await expect(page.locator(`${life} [class*="presentationBar"]`)).toHaveCount(0);
  await expect(page.locator(`${life} [class*="steam"]`)).toHaveCount(4);
  await expect(page.locator(life)).toHaveAttribute("data-attention", "scan");
  const cursor = page.locator(`${life} [class*="cursor"]`);
  await expect.poll(() => cursor.evaluate(node => Number(getComputedStyle(node).opacity))).toBe(0);
  await expect.poll(() => cursor.evaluate(node => Number(getComputedStyle(node).opacity))).toBe(.7);
  expect(errors).toEqual([]);
});

test("wall reactions follow the visitor, and offscreen motion pauses", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Keyboard exploration and desktop page scrolling.");
  await page.goto("/work");
  await enter(page, "Finding founders", false);
  // View the pipeline board from the clear floor in front of the cafe tables.
  const plan = (await page.locator('[class*="OfficeExplorer_plan"]').boundingBox())!;
  await page.mouse.click(plan.x + 238 / 372 * plan.width, plan.y + 88 / 272 * plan.height);
  await expect(page.locator(worker)).toHaveAttribute("data-walking", "false", { timeout: 8000 });
  await face(page, "up", false);
  await expect(page.locator(life)).toHaveAttribute("data-attention", "pipeline");
  await expect(page.locator(`${life} [data-kind="frame"]`)).toHaveCount(1);
  await face(page, "down", false);
  await expect(page.locator(life)).toHaveAttribute("data-attention", "");
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect(page.locator(life)).toHaveAttribute("data-running", "false");
  await expect.poll(() => page.locator(life).evaluate(node => node.getAnimations({ subtree: true }).every(animation => animation.playState !== "running"))).toBe(true);
});

test("reduced motion retains feedback without ambient animation", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/work");
  await enter(page, "Finding founders", info.project.name.startsWith("mobile"));
  await expect(page.locator(life)).toHaveAttribute("data-attention", "scan");
  expect(await page.locator(life).evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator(`${life} [class*="screenLight"]`)).toBeVisible();
  await expect(page.locator(`${life} [class*="steam"]`).first()).toBeHidden();
});
