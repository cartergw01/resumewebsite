import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const sections = JSON.parse(readFileSync(new URL("../../content/best-reads.json", import.meta.url), "utf8")) as {
  topic: string;
  picks: { year: number; title: string; href: string }[];
}[];
const SHOWN = 9;
const newspaper = (page: Page) => page.getByRole("region", { name: "Best things i've read" });

test("the newspaper opens on its first section, with every section named in the bar", async ({ page }) => {
  await page.goto("/writing");
  const paper = newspaper(page);
  const bar = paper.getByRole("group", { name: "Sections" }).getByRole("button");
  await expect(bar).toHaveText(sections.map(({ topic }) => topic));
  await expect(bar.first()).toHaveAttribute("aria-pressed", "true");
  const [first] = sections;
  const showing = paper.getByRole("article", { name: first.topic });
  await expect(showing.getByRole("heading", { level: 3 })).toHaveText(first.picks[0].title);
  await expect(showing.getByRole("link").first()).toHaveAttribute("href", first.picks[0].href);
  // The other sections are in the page, just not showing.
  await expect(paper.getByRole("article")).toHaveCount(1);
});

test("a section's stories run newest year first, each linking out in a new tab", async ({ page }) => {
  await page.goto("/writing");
  const paper = newspaper(page);
  const { topic, picks } = sections.find(section => section.topic === "Relationships")!;
  await paper.getByRole("button", { name: topic, exact: true }).click();
  const showing = paper.getByRole("article", { name: topic });
  const links = showing.getByRole("link");
  await expect(links).toHaveCount(picks.length);
  await expect(links.nth(1)).toHaveAttribute("href", picks[1].href);
  await expect(links.nth(1)).toHaveAttribute("target", "_blank");
  expect(picks.map(pick => pick.year)).toEqual([...picks.map(pick => pick.year)].sort((a, b) => b - a));
});

test("a long section shows its first stories until Show all", async ({ page }) => {
  await page.goto("/writing");
  const paper = newspaper(page);
  const { topic, picks } = sections.reduce((longest, section) => section.picks.length > longest.picks.length ? section : longest);
  await paper.getByRole("button", { name: topic, exact: true }).click();
  const links = paper.getByRole("article", { name: topic }).getByRole("link");
  await expect(links).toHaveCount(1 + SHOWN);
  await paper.getByRole("button", { name: "Show all" }).click();
  await expect(links).toHaveCount(picks.length);
  await expect(paper.getByRole("button", { name: "Show all" })).toHaveCount(0);
  await expect(links.nth(1 + SHOWN)).toBeFocused();
});

test("the list view no longer repeats the reading lists", async ({ page }) => {
  await page.goto("/writing");
  await page.getByRole("button", { name: "Read as a list" }).click();
  await expect(page.getByRole("region", { name: "Substack essay archive" })).not.toContainText("Best Things I Read");
});
