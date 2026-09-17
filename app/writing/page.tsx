import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import IslandReturnLink from "@/components/IslandReturnLink";
import { SubstackSubscribe } from "@/components/SubstackSubscribe";
import { essays } from "@/content/portfolio";
import EssayPage from "@/components/EssayPage";
import styles from "@/components/WritingWorld.module.css";
import {
  breadcrumbJsonLd,
  buildMetadata,
  jsonLdScript,
  webPageJsonLd,
  writingItemListJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata("writing");

const readingLists = essays.filter((essay) => essay.title.startsWith("The Best Things I Read"));
const essayEntries = essays.filter((essay) => !essay.title.startsWith("The Best Things I Read"));
const [featured, ...archive] = essayEntries;

export default function WritingPage() {
  return (
    <div className={`cosmic-subpage subpage-writing subpage-topic topic-page ${styles.page}`} data-rocket-launch-zone>
      <script
        {...jsonLdScript([
          webPageJsonLd("writing", "CollectionPage"),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Writing", path: "/writing" },
          ]),
          writingItemListJsonLd(),
        ])}
      />
      <SiteNav active="writing" />

      <main className="subpage-main topic-main">
        <header className={`subpage-hero topic-hero writing-hero ${styles.hero}`} data-book-reveal>
          <IslandReturnLink island="writing" />
          <h1>Writing</h1>
        </header>

        <section className={styles.feature} aria-label="Featured essay">
          <div className={styles.introduction} data-book-reveal>
            <h2><em>flying Arrows</em></h2>
            <p>essays on human nature, culture, and technology.</p>
          </div>
          <EssayPage essay={{ title: featured.title, subtitle: featured.subtitle, date: featured.date, href: featured.href }} />
        </section>

        <section className="writing-archive" aria-label="Substack essay archive" data-book-reveal>
          <ArchiveGroup title="Essays" entries={archive} />
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
