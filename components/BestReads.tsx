import sections from "@/content/best-reads.json";
import BestReadsSections from "./BestReadsSections";
import styles from "./BestReads.module.css";

const years = sections.flatMap(section => section.picks.map(pick => pick.year));
// Stories shown under the lead before "Show all": three rows of three columns.
const SHOWN = 9;

// Under the board, the picks from Carter's yearly "Best Things I Read"
// round-ups (content/best-reads.json, from scripts/best-reads.mjs), laid out as
// a newspaper: one section at a time, its first pick as the lead story with the
// quote pulled out, the rest in columns. Every section is in the HTML; the
// sections bar only picks which one shows.
export default function BestReads() {
  return (
    <section className={styles.paper} aria-labelledby="best-reads-title">
      <header className={styles.mast}>
        <h2 id="best-reads-title" className={styles.title}>A collection of my favorite books, essays, and articles</h2>
        <p className={styles.dateline}>{Math.min(...years)} – {Math.max(...years)}</p>
      </header>
      <BestReadsSections sections={sections.map(({ topic, picks }) => ({ topic, long: picks.length - 1 > SHOWN }))}>
        {sections.map(({ topic, picks }) => {
          const [lead, ...rest] = picks;
          // A book's line is Carter's own note about it; an essay's is a quote from it.
          const Note = topic === "Books" ? "p" : "q";
          return (
            <article key={topic} aria-label={topic}>
              <a className={styles.lead} href={lead.href} target="_blank" rel="noopener noreferrer">
                <div>
                  <span className={styles.kicker}>{topic} · {lead.year}</span>
                  <h3 className={styles.leadTitle}>{lead.title}</h3>
                  <span className={styles.byline}>by {lead.author}</span>
                </div>
                <Note className={styles.pull}>{lead.quote}</Note>
              </a>
              <ul className={styles.columns}>
                {rest.map((pick, index) => (
                  <li key={pick.href} data-more={index >= SHOWN ? "" : undefined}>
                    <a className={styles.story} href={pick.href} target="_blank" rel="noopener noreferrer">
                      <h4 className={styles.headline}>{pick.title}</h4>
                      <span className={styles.byline}>by {pick.author} · {pick.year}</span>
                      <Note className={styles.note}>{pick.quote}</Note>
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </BestReadsSections>
    </section>
  );
}
