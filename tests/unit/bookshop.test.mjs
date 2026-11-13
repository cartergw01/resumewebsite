import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readBookshopContent } from "../../scripts/blender/bookshop_content.mjs";

const shop = JSON.parse(readFileSync(new URL("../../lib/bookshop.json", import.meta.url), "utf8"));

// The shelves are rendered from the content: a new or renamed essay needs a
// re-render (see docs/bookshop-plan.md) before the page can link to it.
test("the bookshop's books are the site's essays and reading lists, in order", async () => {
  const content = await readBookshopContent();
  assert.deepEqual(shop.essays.map(({ slug, title }) => ({ slug, title })), content.essays.map(({ slug, title }) => ({ slug, title })));
  assert.deepEqual(shop.readingLists.map(({ slug, year }) => ({ slug, year })), content.readingLists.map(({ slug, year }) => ({ slug, year })));
});

test("every clickable face and close-up sits inside the frame", () => {
  const faces = [...shop.essays, ...shop.readingLists].map(book => book.corners).concat([shop.notes, shop.slot]);
  for (const face of faces) {
    assert.equal(face.length, 4);
    for (const [x, y] of face) assert.ok(x >= 0 && x <= 1200 && y >= 0 && y <= 800, `${x},${y} is outside the frame`);
  }
  for (const area of ["essays", "reading", "notes", "letters"]) {
    const [l, t, r, b] = shop.closeups[area].box;
    assert.ok(l >= 0 && t >= 0 && r <= 1200 && b <= 800 && r > l && b > t, `${area}'s close-up box is off the frame`);
  }
});
