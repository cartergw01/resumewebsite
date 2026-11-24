import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const openings = JSON.parse(readFileSync(new URL("../../content/essay-openings.json", import.meta.url), "utf8")) as Record<string, string>;

test("the essays are pinned to the board newest first", async ({ page }) => {
  await page.goto("/writing");
  const cards = page.getByRole("region", { name: "Essays" }).getByRole("button", { name: /, \w{3} \d+, \d{4}$/ });
  await expect(cards).toHaveCount(Object.keys(openings).length);
  const dates = await cards.evaluateAll(buttons => buttons.map(button => Date.parse(`${button.getAttribute("aria-label")!.split(", ").slice(-2).join(", ")} UTC`)));
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
});

test("clicking an essay opens it on how it begins, and the sheet turns to the next one", async ({ page }) => {
  await page.goto("/writing");
  const cards = page.getByRole("region", { name: "Essays" }).getByRole("button", { name: /, \w{3} \d+, \d{4}$/ });
  await cards.first().click();
  const sheet = page.locator("dialog[open]");
  const title = await sheet.getByRole("heading").textContent();
  const link = sheet.getByRole("link", { name: /Keep reading on Substack/ });
  const slug = new URL((await link.getAttribute("href"))!).pathname.split("/").filter(Boolean).pop()!;
  await expect(sheet).toContainText(openings[slug].split("\n")[0].slice(0, 40));
  // Let the card finish lifting into the sheet before turning the page.
  await expect(sheet).toHaveAttribute("data-phase", "open");
  await sheet.locator("article").evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await sheet.getByRole("button", { name: /Next/ }).click();
  await expect(sheet.getByRole("heading")).not.toHaveText(title!);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("the bulletin and the list are two views, one at a time", async ({ page }) => {
  await page.goto("/writing");
  const board = page.getByRole("region", { name: "Essays" });
  const list = page.getByRole("region", { name: "Substack essay archive" });
  await expect(page.getByRole("button", { name: "Bulletin" })).toHaveAttribute("aria-pressed", "true");
  await expect(board).toBeVisible();
  await expect(list).toHaveCount(0);
  await page.getByRole("button", { name: "Read as a list" }).click();
  await expect(list).toBeVisible();
  await expect(board).toHaveCount(0);
  await page.getByRole("button", { name: "Bulletin" }).click();
  await expect(board).toBeVisible();
});

test("the mailbox on the board opens the tweets", async ({ page }) => {
  await page.goto("/writing");
  const mailbox = page.getByRole("button", { name: /some of my tweets/ });
  await mailbox.click();
  const reader = page.locator("dialog[open]");
  await expect(reader.locator("[data-thought-id]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(mailbox).toBeFocused();
});
