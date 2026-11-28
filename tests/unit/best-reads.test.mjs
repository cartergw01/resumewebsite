import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readEssayContent } from "../../scripts/essay-content.mjs";
import { bySection, picksFrom, SECTIONS } from "../../scripts/best-reads.mjs";

const saved = JSON.parse(readFileSync(new URL("../../content/best-reads.json", import.meta.url), "utf8"));

// The three ways the round-ups have laid a pick out, from the real posts.
const post = `
  <h1>Books</h1>
  <ul><li><p><a href="https://www.amazon.com/Same-Ever/dp/0593332709/ref=sr_1_1?crid=X&amp;qid=1">Same as Ever</a> by Morgan Housel</p></li></ul>
  <blockquote><p><em>Behaviors that never change are history’s most powerful lessons.</em></p></blockquote>
  <figure><svg><path d="M1 2"></path></svg></figure>
  <h1>Blogs/Articles/Essays</h1>
  <h3>General</h3>
  <ul><li><p><a href="https://example.substack.com/p/obsessive?r=15gwd5&amp;utm_medium=ios">Obsessions</a> by Nix (Starting from Nix)</p>
  <blockquote><p><em>The world is a museum of obsessions &amp;lt;3</em></p></blockquote></li></ul>
  <h2>On Creative Work</h2>
  <p><a href="https://paulgraham.com/writes.html">Writes and Write-Nots</a> by Paul Graham</p>
  <blockquote><p>a world divided into writes and write-nots</p></blockquote>
  <p><a href="https://example.com/subscribe">Subscribe now</a></p>`;

test("each pick keeps its heading, author, clean link and quote", () => {
  const picks = picksFrom(post, 2024);
  assert.deepEqual(picks.map(({ heading, title, author }) => [heading, title, author]), [
    ["Books", "Same as Ever", "Morgan Housel"],
    ["General", "Obsessions", "Nix"],
    ["Creative Work", "Writes and Write-Nots", "Paul Graham"],
  ]);
  assert.equal(picks[0].href, "https://www.amazon.com/Same-Ever/dp/0593332709/ref=sr_1_1");
  assert.equal(picks[1].href, "https://example.substack.com/p/obsessive");
  assert.equal(picks[1].quote, "The world is a museum of obsessions &lt;3");
});

test("a heading that isn't in a section stops the script instead of losing picks", () => {
  assert.throws(() => bySection([{ year: 2026, heading: "Sports", title: "t", author: "a", href: "https://x.test", quote: "" }]), /Sports/);
});

test("the saved newspaper has every section in order, every round-up, and no empty picks", async () => {
  assert.deepEqual(saved.map(({ topic }) => topic), SECTIONS.map(([topic]) => topic));
  const { readingLists } = await readEssayContent();
  const years = new Set(saved.flatMap(({ picks }) => picks.map(pick => pick.year)));
  for (const list of readingLists) assert.ok(years.has(Number(list.title.match(/\d{4}/)[0])), `${list.title} has no picks saved: run node scripts/best-reads.mjs`);
  for (const { picks } of saved) for (const pick of picks) assert.ok(pick.title && pick.author && pick.quote && pick.href.startsWith("https://"), JSON.stringify(pick));
});
