import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const shelf = JSON.parse(readFileSync(new URL("../../content/reading-shelf.json", import.meta.url), "utf8")) as {
  topic: string;
  picks: { year: number; title: string; href: string }[];
}[];

test("the shelf holds one book per topic, and no list until one is pulled out", async ({ page }) => {
  await page.goto("/writing");
  const books = page.getByRole("region", { name: "Best things i've read" }).getByRole("button", { expanded: false });
  await expect(books).toHaveText(shelf.map(({ topic }) => topic));
  await expect(page.locator("#reading-shelf-list a")).toHaveCount(0);
});

test("pulling a book out lists its picks newest year first; putting it back clears them", async ({ page }) => {
  await page.goto("/writing");
  const region = page.getByRole("region", { name: "Best things i've read" });
  const { topic, picks } = shelf.find(entry => entry.topic === "Relationships")!;
  const book = region.getByRole("button", { name: topic, exact: true });
  await book.click();
  await expect(book).toHaveAttribute("aria-expanded", "true");
  const links = page.locator("#reading-shelf-list a");
  await expect(links).toHaveCount(picks.length);
  await expect(links.first()).toHaveAttribute("href", picks[0].href);
  await expect(links.first()).toHaveAttribute("target", "_blank");
  const years = await page.locator("#reading-shelf-list section").evaluateAll(sections => sections.map(section => Number(section.getAttribute("aria-label"))));
  expect(years).toEqual([...years].sort((a, b) => b - a));

  // Another book swaps the list; the same book again puts it away.
  const other = region.getByRole("button", { name: "Books", exact: true });
  await other.click();
  await expect(book).toHaveAttribute("aria-expanded", "false");
  await expect(links).toHaveCount(shelf.find(entry => entry.topic === "Books")!.picks.length);
  await other.click();
  await expect(links).toHaveCount(0);

  // The × puts it back too, and hands focus to the book.
  await book.click();
  await page.getByRole("button", { name: `Put ${topic} back` }).click();
  await expect(links).toHaveCount(0);
  await expect(book).toBeFocused();
});

test("the list view no longer repeats the reading lists", async ({ page }) => {
  await page.goto("/writing");
  await page.getByRole("button", { name: "Read as a list" }).click();
  await expect(page.getByRole("region", { name: "Substack essay archive" })).not.toContainText("Best Things I Read");
});
