import SiteNav from "@/components/SiteNav";
import { essays, writingThreads } from "@/content/portfolio";

export default function WritingPage() {
  const [featuredEssay, ...otherEssays] = essays;

  return (
    <div className="cosmic-subpage subpage-writing subpage-topic topic-page">
      <SiteNav active="writing" />

      <main className="subpage-main topic-main">
        <header className="subpage-hero topic-hero writing-hero">
          <span>Writing</span>
          <h1>Essays from the edge of the feed.</h1>
          <p>
            I write about technology, identity, culture, markets, and what it feels like to grow up
            while everything keeps accelerating.
          </p>
          <div className="topic-meta-strip" aria-label="Writing themes">
            <span>Technology</span>
            <span>Identity</span>
            <span>Markets</span>
          </div>
        </header>

        <section className="topic-layout writing-layout" aria-label="Writing world">
          <aside className="subpage-world-art topic-world-art" aria-hidden="true" />

          <div className="topic-content writing-content">
            <section className="writing-thread-grid" aria-label="Writing threads">
              {writingThreads.map(([title, copy], index) => (
                <article
                  className="subpage-panel writing-thread"
                  key={title}
                  style={{ animationDelay: `${0.08 + index * 0.045}s` }}
                >
                  <span>{title}</span>
                  <p>{copy}</p>
                </article>
              ))}
            </section>

            <section className="essay-stack" aria-label="Selected essays">
              <a
                className="essay-card essay-featured"
                href={featuredEssay.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ animationDelay: "0.18s" }}
              >
                <span>{featuredEssay.tag}</span>
                <h2>{featuredEssay.title}</h2>
                <p>{featuredEssay.subtitle}</p>
              </a>

              <div className="essay-list-compact">
                {otherEssays.map((essay, index) => (
                  <a
                    className="essay-row"
                    key={essay.title}
                    href={essay.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ animationDelay: `${0.24 + index * 0.045}s` }}
                  >
                    <span>{essay.tag}</span>
                    <strong>{essay.title}</strong>
                    <p>{essay.subtitle}</p>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
