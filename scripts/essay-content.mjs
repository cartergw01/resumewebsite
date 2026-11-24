// Read the essays and reading lists out of content/portfolio.ts for scripts
// that run in plain Node (content/portfolio.ts imports images, so it can't be
// imported directly).
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

export async function readEssayContent() {
  const source = await readFile(path.join(root, "content/portfolio.ts"), "utf8");
  const start = source.indexOf("export const essays = [");
  const end = source.indexOf("\n];", start);
  if (start < 0 || end < 0) throw new Error("Couldn't find `export const essays` in content/portfolio.ts");
  const literal = source.slice(start + "export const essays = ".length, end + 3).replace(/image: (\w+),/g, "image: null,");
  const essays = new Function(`return ${literal}`)();
  const book = (essay) => ({
    title: essay.title,
    slug: new URL(essay.href).pathname.split("/").filter(Boolean).pop(),
    date: essay.date,
    iso: new Date(`${essay.date} UTC`).toISOString().slice(0, 10),
  });
  // The same split as content/portfolio.ts's ownEssays.
  const isReadingList = (essay) => essay.title.startsWith("The Best Things I Read");
  return {
    essays: essays.filter((essay) => !isReadingList(essay)).map(book),
    readingLists: essays.filter(isReadingList).map(book),
  };
}
