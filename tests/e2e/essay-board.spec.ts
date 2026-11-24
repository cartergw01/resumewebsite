import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const openings = JSON.parse(readFileSync(new URL("../../content/essay-openings.json", import.meta.url), "utf8")) as Record<string, string>;

test("the essays are pinned to the board oldest first", async ({ page }) => {
  await page.goto("/writing");
  const cards = page.getByRole("region", { name: "Essays" }).getByRole("button");
  await expect(cards).toHaveCount(Object.keys(openings).length);
  const dates = await cards.evaluateAll(buttons => buttons.map(button => Date.parse(`${button.getAttribute("aria-label")!.split(", ").slice(-2).join(", ")} UTC`)));
  expect(dates).toEqual([...dates].sort((a, b) => a - b));
});

test("clicking an essay opens it on how it begins, and the sheet turns to the next one", async ({ page }) => {
  await page.goto("/writing");
  const cards = page.getByRole("region", { name: "Essays" }).getByRole("button");
  await cards.first().click();
  const sheet = page.locator("dialog[open]");
  const title = await sheet.getByRole("heading").textContent();
  const link = sheet.getByRole("link", { name: /Keep reading on Substack/ });
  const slug = new URL((await link.getAttribute("href"))!).pathname.split("/").filter(Boolean).pop()!;
  await expect(sheet).toContainText(openings[slug].split("\n")[0].slice(0, 40));
  await sheet.getByRole("button", { name: /Next/ }).click();
  await expect(sheet.getByRole("heading")).not.toHaveText(title!);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});
