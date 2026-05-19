import SiteNav from "@/components/SiteNav";
import { lifeNotes } from "@/content/portfolio";

export default function LifePage() {
  return (
    <div className="cosmic-subpage subpage-life subpage-topic topic-page">
      <SiteNav active="life" />

      <main className="subpage-main topic-main">
        <header className="subpage-hero topic-hero life-hero">
          <span>Life</span>
          <h1>Taipei days, SoCal roots.</h1>
          <p>
            Outside of work, you can usually find me watching the Lakers, playing poker, biking
            around the city, reading, or writing things down.
          </p>
          <div className="topic-meta-strip" aria-label="Life anchors">
            <span>Taipei</span>
            <span>Lakers</span>
            <span>Poker</span>
            <span>Bikes</span>
          </div>
        </header>

        <section className="topic-layout life-layout" aria-label="Life world">
          <aside className="subpage-world-art topic-world-art" aria-hidden="true" />

          <div className="topic-content">
            <section className="life-grid life-grid-refined" aria-label="Life notes">
              {lifeNotes.map(([label, value, sub], index) => (
                <article
                  className="life-note"
                  key={label}
                  style={{ animationDelay: `${0.08 + index * 0.045}s` }}
                >
                  <span>{label}</span>
                  <h2>{value}</h2>
                  <p>{sub}</p>
                </article>
              ))}
            </section>

            <article className="subpage-panel subpage-note life-current" style={{ animationDelay: "0.36s" }}>
              <div className="panel-kicker">
                <span>Current rhythm</span>
                <span>Taipei</span>
              </div>
              <p>
                Taipei rewards wandering: great food, dense energy, easy living, and night markets
                that make ordinary evenings feel like small adventures.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
