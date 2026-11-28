import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readEssayContent } from "../../scripts/essay-content.mjs";

const openings = JSON.parse(readFileSync(new URL("../../content/essay-openings.json", import.meta.url), "utf8"));

// The reading sheet shows how each essay begins: a new essay needs
// `node scripts/essay-openings.mjs` after it's published.
test("every essay on the board has its opening saved", async () => {
  const { essays } = await readEssayContent();
  for (const essay of essays) {
    assert.ok(openings[essay.slug]?.length > 40, `${essay.title} has no opening in content/essay-openings.json`);
  }
});
