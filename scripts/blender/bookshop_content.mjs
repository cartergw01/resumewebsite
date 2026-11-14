// Read the essays and reading lists out of content/portfolio.ts for the
// bookshop's Blender build, so the books on its shelves are the site's own.
// node scripts/blender/bookshop_content.mjs  ->  .blender-build/bookshop-content.json
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

export async function readBookshopContent() {
  const source = await readFile(path.join(root, "content/portfolio.ts"), "utf8");
  const images = Object.fromEntries(
    [...source.matchAll(/^import (\w+) from "@\/public\/(essay-covers\/[^"]+)";$/gm)].map(([, name, file]) => [name, file]),
  );
  const start = source.indexOf("export const essays = [");
  const end = source.indexOf("\n];", start);
  if (start < 0 || end < 0) throw new Error("Couldn't find `export const essays` in content/portfolio.ts");
  let literal = source.slice(start + "export const essays = ".length, end + 3);
  literal = literal.replace(/image: (\w+),/g, (_, name) => {
    if (!images[name]) throw new Error(`No cover import for ${name}`);
    return `image: ${JSON.stringify(images[name])},`;
  });
  const essays = new Function(`return ${literal}`)();
  const slug = (href) => new URL(href).pathname.split("/").filter(Boolean).pop();
  const position = (value = "50% 50%") => value.split(" ").map((part) => Number.parseFloat(part) / 100);
  const book = (essay) => ({
    title: essay.title,
    slug: slug(essay.href),
    image: essay.image,
    position: position(essay.imagePosition),
    spine: essay.spine,
    date: essay.date,
    iso: new Date(`${essay.date} UTC`).toISOString().slice(0, 10),
  });
  // The same split as content/portfolio.ts's ownEssays.
  const isReadingList = (essay) => essay.title.startsWith("The Best Things I Read");
  const content = {
    essays: essays.filter((essay) => !isReadingList(essay)).map(book),
    readingLists: essays.filter(isReadingList).map((essay) => ({ ...book(essay), year: essay.title.match(/\d{4}/)[0] })),
  };
  return content;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const content = await readBookshopContent();
  await mkdir(path.join(root, ".blender-build"), { recursive: true });
  await writeFile(path.join(root, ".blender-build/bookshop-content.json"), JSON.stringify(content, null, 2) + "\n");
  console.log(`${content.essays.length} essays, ${content.readingLists.length} reading lists`);
}
