import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readBookshopContent } from "../../scripts/blender/bookshop_content.mjs";

const shop = JSON.parse(readFileSync(new URL("../../lib/bookshop.json", import.meta.url), "utf8"));

// The shelves are rendered from the content: a new or renamed essay needs a
// re-render (see docs/bookshop-plan.md) before the page can link to it.
test("the bookshop's books are the site's essays and reading lists", async () => {
  const content = await readBookshopContent();
  assert.deepEqual(shop.essays.map(({ slug, title }) => ({ slug, title })), content.essays.map(({ slug, title }) => ({ slug, title })));
  assert.deepEqual(shop.readingLists.map(({ slug, year }) => ({ slug, year })), content.readingLists.map(({ slug, year }) => ({ slug, year })));
});

test("the shelf runs as a timeline: each year's essays stand in that year's bay, in order", async () => {
  const content = await readBookshopContent();
  const at = slug => { const [l, , r] = shop.essays.find(book => book.slug === slug).rect; return (l + r) / 2; };
  const byDate = [...content.essays].sort((a, b) => a.iso.localeCompare(b.iso));
  for (let i = 1; i < byDate.length; i++) assert.ok(at(byDate[i].slug) > at(byDate[i - 1].slug), `${byDate[i].title} should come after ${byDate[i - 1].title}`);
  for (const essay of content.essays) {
    const bay = shop.bays.find(b => b.year === essay.iso.slice(0, 4));
    assert.ok(bay && at(essay.slug) > bay.x0 && at(essay.slug) < bay.x1, `${essay.title} is outside its year's bay`);
  }
});

test("the tiles cover the whole shop, and everything you can reach is inside it", () => {
  assert.equal(shop.tiles.reduce((width, tile) => width + tile.width, 0), shop.width);
  const rects = [...shop.essays, ...shop.readingLists].map(book => book.rect).concat([shop.notes, shop.letters]);
  for (const [l, t, r, b] of rects) assert.ok(l >= 0 && t >= 0 && r <= shop.width && b <= shop.height && r > l && b > t, `${[l, t, r, b]} is outside the shop`);
  // Reading lists stand on tables in front, which move with their own layer.
  for (const list of shop.readingLists) assert.ok(list.layer && shop.pieces[list.layer], `${list.title} has no table`);
});
