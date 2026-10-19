import fs from "node:fs";
import path from "node:path";

// The words on /work live in content/work.md so they can be edited without
// touching code. This reads that file into the page's sections; WorkRoom
// renders the inline links and italics.

export type WorkEntry = { title: string; paragraphs: string[]; more?: { href: string; label: string } };
type Section = { paragraphs: string[]; entries: WorkEntry[]; list: string[] };

const loneLink = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function parse(source: string) {
  const sections = new Map<string, Section>();
  let section: Section | undefined;
  let paragraph: string[] = [];

  const flush = () => {
    if (!paragraph.length || !section) return void (paragraph = []);
    const text = paragraph.join(" ");
    const entry = section.entries.at(-1);
    (entry ? entry.paragraphs : section.paragraphs).push(text);
    paragraph = [];
  };

  for (const raw of source.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      if (heading[1] === "#") {
        section = { paragraphs: [], entries: [], list: [] };
        sections.set(heading[2], section);
      } else {
        section?.entries.push({ title: heading[2], paragraphs: [] });
      }
    } else if (line.startsWith("- ")) {
      flush();
      section?.list.push(line.slice(2));
    } else if (line) {
      paragraph.push(line);
    } else {
      flush();
    }
  }
  flush();
  return sections;
}

export function getWorkCopy() {
  const sections = parse(fs.readFileSync(path.join(process.cwd(), "content/work.md"), "utf8"));
  const get = (name: string) => {
    const section = sections.get(name);
    if (!section) throw new Error(`content/work.md is missing its "# ${name}" section`);
    return section;
  };

  // A side item's last paragraph, when it is only a link, is its "more" link.
  const onTheSide = get("On the side").entries.map((entry) => {
    const link = loneLink.exec(entry.paragraphs.at(-1) ?? "");
    return link ? { ...entry, paragraphs: entry.paragraphs.slice(0, -1), more: { label: link[1], href: link[2] } } : entry;
  });

  const about = get("About me");
  return {
    now: { intro: get("Now").paragraphs, highlights: get("Now").entries },
    previously: get("Previously").entries,
    onTheSide,
    about: {
      facts: about.list.map((item) => {
        const [label, ...value] = item.split(":");
        return { label: label.trim(), value: value.join(":").trim() };
      }),
      paragraphs: about.paragraphs,
    },
    closing: get("Closing").paragraphs,
  };
}
