// Save how each essay begins, from the flying Arrows feed, for the bookshop's
// open book. Run after publishing; the result is committed, so the site never
// fetches anything at build time.
// node scripts/essay-openings.mjs  ->  content/essay-openings.json
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readBookshopContent } from "./blender/bookshop_content.mjs";

const root = path.resolve(import.meta.dirname, "..");
const response = await fetch("https://carterko.substack.com/feed");
if (!response.ok) throw new Error(`The feed answered ${response.status}`);
const feed = await response.text();

const decode = (text) => text
  .replace(/<br\s*\/?>/g, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

// The first real paragraphs, up to about a short page: whole sentences only.
function opening(html) {
  // Images and their captions, headings and footnote markers aren't the essay.
  html = html
    .replace(/<figure[\s\S]*?<\/figure>/g, "")
    .replace(/<figcaption[\s\S]*?<\/figcaption>/g, "")
    .replace(/<h[1-6][\s\S]*?<\/h[1-6]>/g, "")
    .replace(/<a[^>]*class="footnote-anchor[^"]*"[^>]*>[\s\S]*?<\/a>/g, "")
    .replace(/<sup[\s\S]*?<\/sup>/g, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/g, "");
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, inner]) => decode(inner))
    .filter((text) => text.length > 40 && !/^(subscribe|share|thanks for reading)/i.test(text));
  const kept = [];
  let length = 0;
  for (const paragraph of paragraphs) {
    if (length > 0 && length + paragraph.length > 420) break;
    kept.push(paragraph);
    length += paragraph.length;
    if (length > 220) break;
  }
  let text = kept.join("\n\n");
  if (text.length > 460) {
    const cut = text.slice(0, 460);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    text = end > 120 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
  }
  return text;
}

const items = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
  slug: item.match(/<link>https:\/\/carterko\.substack\.com\/p\/([^<]+)<\/link>/)?.[1],
  html: item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] ?? "",
}));
const content = await readBookshopContent();
const openings = {};
// Only the essays: the reading lists open on other writers' words, so they keep
// just their own subtitle.
for (const { slug } of content.essays) {
  const item = items.find((entry) => entry.slug === slug);
  if (!item) { console.warn(`Not in the feed: ${slug}`); continue; }
  openings[slug] = opening(item.html);
}
await writeFile(path.join(root, "content/essay-openings.json"), JSON.stringify(openings, null, 2) + "\n");
console.log(`Saved the openings of ${Object.keys(openings).length} essays.`);
