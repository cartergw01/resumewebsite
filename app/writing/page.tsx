import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import { SubstackSubscribe } from "@/components/SubstackSubscribe";
import { essays } from "@/content/portfolio";

export const metadata: Metadata = {
  title: "Writing — Carter Wang",
  description:
    "Essays on human nature, culture, and technology at flying Arrows on Substack.",
};

const readingLists = essays.filter((essay) => essay.title.startsWith("The Best Things I Read"));
const essayEntries = essays.filter((essay) => !essay.title.startsWith("The Best Things I Read"));

export default function WritingPage() {
  return (
    <div className="cosmic-subpage subpage-writing subpage-topic topic-page" data-rocket-launch-zone>
      <SiteNav active="writing" />

      <main className="subpage-main topic-main">
        <header className="subpage-hero topic-hero writing-hero">
          <h1>Writing</h1>
        </header>

        <section className="writing-archive" aria-label="Substack essay archive">
          <ArchiveGroup title="Essays" entries={essayEntries} />
          <ArchiveGroup
            title="Reading Lists"
            entries={readingLists}
            offset={essayEntries.length}
            showSubtitles={false}
          />
        </section>

        <SubstackSubscribe />
      </main>
    </div>
  );
}

function ArchiveGroup({
  entries,
  offset = 0,
  showSubtitles = true,
  title,
}: {
  entries: typeof essays;
  offset?: number;
  showSubtitles?: boolean;
  title: string;
}) {
  return (
    <div className="archive-group">
      <h2 className="archive-group-heading">{title}</h2>
      <div className="archive-list">
        {entries.length === 0 ? (
          <p className="archive-empty">Nothing published here yet.</p>
        ) : entries.map((essay, index) => {
          return (
            <a
              className="archive-row"
              href={essay.href}
              key={essay.title}
              target="_blank"
              rel="noopener noreferrer"
              style={{ animationDelay: `${0.08 + (offset + index) * 0.035}s` }}
            >
              <span className="archive-main">
                <strong>{essay.title}</strong>
                {showSubtitles ? <span>{essay.subtitle}</span> : null}
              </span>
              <span className="archive-meta">
                <time dateTime={toDateTime(essay.date)}>{essay.date}</time>
              </span>
              <span className="archive-action" aria-hidden="true">View →</span>
              <span className="sr-only">Open on Substack</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function toDateTime(date: string) {
  const parsed = new Date(`${date} UTC`);

  if (Number.isNaN(parsed.valueOf())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}
