import type { Metadata } from "next";
import type { CSSProperties } from "react";
import SiteNav from "@/components/SiteNav";
import MobileContact from "@/components/MobileContact";
import GalaxyBackground from "@/components/GalaxyBackground";
import { SubstackSubscribe } from "@/components/SubstackSubscribe";
import { essays, ownEssays } from "@/content/portfolio";
import WritingHeading from "@/components/WritingHeading";
import IslandLine from "@/components/IslandLine";
import WritingViews from "@/components/WritingViews";
import BestReads from "@/components/BestReads";
import styles from "@/components/WritingWorld.module.css";
import {
  breadcrumbJsonLd,
  buildMetadata,
  jsonLdScript,
  webPageJsonLd,
  writingItemListJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata("writing");

const essayEntries = ownEssays;

export default function WritingPage() {
  return (
    <div className={`cosmic-subpage subpage-writing subpage-topic topic-page ${styles.page}`} data-rocket-launch-zone data-island-page>
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
      <GalaxyBackground page playbackRate={0.6} />
      <div className={styles.lamplight} data-reading-light aria-hidden="true" />

      <main className="subpage-main topic-main">
        <WritingViews
          title={<WritingHeading />}
          line={<p><IslandLine id="writing" /></p>}
          list={
            <section id="writing-archive" className="writing-archive" aria-label="Substack essay archive" style={{ scrollMarginTop: "6rem" }}>
              <ArchiveGroup title="Essays" entries={essayEntries} />
            </section>
          }
        />

        <BestReads />

        <SubstackSubscribe />
        <MobileContact />
      </main>
    </div>
  );
}

function ArchiveGroup({ entries, title }: { entries: typeof essays; title: string }) {
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
              style={{ animationDelay: `${0.08 + index * 0.035}s`, "--row": index } as CSSProperties}
            >
              <span className="archive-main">
                <strong>{essay.title}</strong>
                <span>{essay.subtitle}</span>
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
