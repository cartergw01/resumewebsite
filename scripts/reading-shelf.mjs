// Save the picks from each "The Best Things I Read in …" post, sorted onto the
// Writing page's bookshelf by topic. Run after publishing a new round-up; the
// result is committed, so the site never fetches anything at build time.
// node scripts/reading-shelf.mjs  ->  content/reading-shelf.json
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEssayContent } from "./essay-content.mjs";

// One book on the shelf per topic, in shelf order. The headings in the posts
// changed a little from year to year; each one files under one of these.
export const SHELF = [
  ["Books", ["Books"]],
  ["Technology & Business", ["Technology & Business"]],
  ["General", ["General", "Various Topics"]],
  ["Culture & Politics", ["Culture & Society", "Politics", "Politics & Culture"]],
  ["Life", ["Life", "Life & Philosophy"]],
  ["Work & Creativity", ["Work", "Creative Work"]],
  ["Relationships", ["Relationships"]],
];
const topicOf = (heading) => SHELF.find(([, headings]) => headings.includes(heading))?.[0];

const decode = (text) => text
  .replace(/<br\s*\/?>/g, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  // &amp; last, so an escaped entity like &amp;lt; stays the text "&lt;".
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();

// Links without the sharing and shop tracking tacked onto them.
function cleanLink(href) {
  const url = new URL(decode(href));
  if (url.hostname.endsWith("amazon.com")) url.search = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_|^(r|triedRedirect|showWelcomeOnShare|f)$/.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

// Every pick in one post: a linked title, "by" (or a dash) and who wrote it,
// then the quote or note under it. Headings say whether it's a book or which
// topic an essay sits under.
export function picksFrom(html, year) {
  const picks = [];
  let kind = null, heading = null, last = null;
  const blocks = /<(h[1-6])(?:\s[^>]*)?>([\s\S]*?)<\/\1>|<blockquote(?:\s[^>]*)?>([\s\S]*?)<\/blockquote>|<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g;
  for (const [, tag, headingHtml, quoteHtml, paragraphHtml] of html.matchAll(blocks)) {
    const inner = headingHtml ?? paragraphHtml;
    const pick = inner?.match(/^\s*(?:<(?:strong|em)>)?\s*<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*(?:<\/(?:strong|em)>)?\s*(?:by|-|–)\s+([\s\S]+)$/);
    if (tag && !pick) {
      const text = decode(headingHtml);
      if (/^books$/i.test(text)) { kind = "book"; heading = "Books"; }
      else if (/blogs\/articles\/essays/i.test(text)) { kind = "essay"; heading = null; }
      else if (kind === "essay" || /^On /.test(text)) { kind = "essay"; heading = text.replace(/^On /, ""); }
      last = null;
      continue;
    }
    if (quoteHtml !== undefined) {
      if (last && !last.quote) last.quote = decode(quoteHtml);
      continue;
    }
    if (pick && kind && heading) {
      const [, href, title, author] = pick;
      last = { year, heading, title: decode(title), author: decode(author).replace(/\s*\(.*$/, ""), href: cleanLink(href), quote: "" };
      picks.push(last);
      continue;
    }
    // A book's note is a plain paragraph under it, not a quote.
    if (paragraphHtml && last?.heading === "Books" && !last.quote && decode(paragraphHtml).length > 60) last.quote = decode(paragraphHtml);
  }
  return picks;
}

export function shelve(picks) {
  for (const pick of picks) {
    if (!topicOf(pick.heading)) throw new Error(`"${pick.heading}" (${pick.year}) isn't on the shelf yet: add it to SHELF in scripts/reading-shelf.mjs`);
  }
  return SHELF.map(([topic]) => ({
    topic,
    picks: picks.filter((pick) => topicOf(pick.heading) === topic)
      .sort((a, b) => b.year - a.year)
      .map(({ year, title, author, href, quote }) => ({ year, title, author, href, quote })),
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "..");
  const { readingLists } = await readEssayContent();
  const picks = [];
  for (const { slug, title } of readingLists) {
    const year = Number(title.match(/\d{4}/)?.[0]);
    const response = await fetch(`https://carterko.substack.com/api/v1/posts/${slug}`);
    if (!response.ok) throw new Error(`${slug} answered ${response.status}`);
    const found = picksFrom((await response.json()).body_html, year);
    if (found.length === 0) throw new Error(`Found no picks in ${slug}`);
    picks.push(...found);
  }
  const shelf = shelve(picks);
  await writeFile(path.join(root, "content/reading-shelf.json"), JSON.stringify(shelf, null, 2) + "\n");
  console.log(shelf.map(({ topic, picks }) => `${topic}: ${picks.length}`).join("\n"));
}
