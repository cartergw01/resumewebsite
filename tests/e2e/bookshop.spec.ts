import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const shop = JSON.parse(readFileSync(new URL("../../lib/bookshop.json", import.meta.url), "utf8")) as typeof import("../../lib/bookshop.json");
const titleOf = (slug: string) => shop.essays.find(essay => essay.slug === slug)?.title ?? shop.readingLists.find(list => list.slug === slug)!.title;

test("the bookshop zooms into each area and steps back out", async ({ page, isMobile }) => {
  await page.goto("/writing");
  const stage = page.locator("[data-area]");
  await expect(stage).toHaveAttribute("data-area", "shop");
  const areas = page.getByRole("navigation", { name: "Bookshop areas" });

  // Essays: the newest is chosen on arrival, and its card links to Substack.
  await areas.getByRole("button", { name: "Essays", exact: true }).click();
  await expect(stage).toHaveAttribute("data-area", "essays");
  await expect(stage).toHaveAttribute("data-settled", "true");
  const card = page.locator("section[aria-label='The bookshop'] article");
  await expect(card.getByRole("heading")).toHaveText(titleOf(shop.essays[0].slug));
  await expect(card.getByRole("link", { name: /Read on Substack/ })).toHaveAttribute("href", `https://carterko.substack.com/p/${shop.essays[0].slug}`);
  // The sharp close-up sits over the still once the zoom settles.
  await expect(page.locator("img[src*='bookshop-essays'], img[srcset*='bookshop-essays']")).toHaveCSS("opacity", "1");

  // Choosing another book by its cover.
  await page.getByRole("button", { name: shop.essays[2].title, exact: true }).click();
  await expect(card.getByRole("heading")).toHaveText(titleOf(shop.essays[2].slug));
  if (!isMobile) {
    await page.keyboard.press("ArrowRight");
    await expect(card.getByRole("heading")).toHaveText(titleOf(shop.essays[3].slug));
  }

  // Reading Lists start at the latest year.
  await areas.getByRole("button", { name: "Reading Lists" }).click();
  await expect(stage).toHaveAttribute("data-area", "reading");
  const latest = [...shop.readingLists].sort((a, b) => Number(b.year) - Number(a.year))[0];
  await expect(card.getByRole("heading")).toHaveText(latest.title);

  // The newsletter slot shows the subscribe form.
  await areas.getByRole("button", { name: "Newsletter" }).click();
  await expect(stage).toHaveAttribute("data-area", "letters");
  await expect(page.locator("#bookshop-email")).toBeVisible();

  await areas.getByRole("button", { name: "Whole shop" }).click();
  await expect(stage).toHaveAttribute("data-area", "shop");
});

test("the corkboard opens the tweet reader, and Escape leaves the shop zoomed out", async ({ page, isMobile }) => {
  await page.goto("/writing");
  const stage = page.locator("[data-area]");
  await page.getByRole("navigation", { name: "Bookshop areas" }).getByRole("button", { name: "some of my tweets" }).click();
  const reader = page.locator("dialog[open]");
  await expect(reader).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
  await expect(stage).toHaveAttribute("data-area", "notes");
  if (!isMobile) {
    await page.keyboard.press("Escape");
    await expect(stage).toHaveAttribute("data-area", "shop");
  }
});

test("a sideways swipe on the shelf moves to the next essay", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Swiping is for touch screens");
  await page.goto("/writing");
  await page.getByRole("navigation", { name: "Bookshop areas" }).getByRole("button", { name: "Essays", exact: true }).click();
  const stage = page.locator("[data-area]");
  await expect(stage).toHaveAttribute("data-settled", "true");
  const box = (await stage.boundingBox())!;
  const y = box.y + box.height * .85;
  // A touch drag, dispatched as pointer events the way a finger sends them.
  await stage.dispatchEvent("pointerdown", { pointerType: "touch", clientX: box.x + box.width * .8, clientY: y, isPrimary: true });
  await stage.dispatchEvent("pointerup", { pointerType: "touch", clientX: box.x + box.width * .2, clientY: y + 4, isPrimary: true });
  await expect(page.locator("section[aria-label='The bookshop'] article").getByRole("heading")).toHaveText(titleOf(shop.essays[1].slug));
});
