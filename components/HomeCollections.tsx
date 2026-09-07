import Image from "next/image";
import Link from "next/link";
import { essays, projects } from "@/content/portfolio";
import styles from "./HomeCollections.module.css";

// Deliberate line breaks give each jacket a composition; annual lists are a series.
const jackets: Record<string, { design: string; lines: string[] }> = {
  "The Cost of Keeping Up": { design: "keeping", lines: ["The Cost", "of Keeping", "Up"] },
  "Slop and Spiral": { design: "spiral", lines: ["Slop", "and", "Spiral"] },
  "The Best Things I Read in 2025": { design: "annualOchre", lines: ["The Best Things", "I Read in", "2025"] },
  "We All Have Superpowers": { design: "powers", lines: ["We All", "Have", "Superpowers"] },
  "The Mirage of Identity": { design: "mirage", lines: ["The Mirage", "of Identity"] },
  "The Best Things I Read in 2024": { design: "annualRed", lines: ["The Best Things", "I Read in", "2024"] },
  "From Crash to Curiosity": { design: "curiosity", lines: ["From Crash", "to Curiosity"] },
  "Work as Play": { design: "play", lines: ["Work", "as", "Play"] },
  "Fuck It, We Ball!": { design: "ball", lines: ["Fuck It,", "We Ball!"] },
  "The Best Things I Read in 2023": { design: "annualBlue", lines: ["The Best Things", "I Read in", "2023"] },
  "An Ode to Ignorance": { design: "ignorance", lines: ["An Ode", "to", "Ignorance"] },
};

const spiralLine = Array.from({ length: 181 }, (_, index) => {
  const angle = index * Math.PI / 24;
  const radius = 2 + angle * 6;
  return `${index ? "L" : "M"}${(100 + Math.cos(angle) * radius).toFixed(2)},${(100 + Math.sin(angle) * radius).toFixed(2)}`;
}).join(" ");

export default function HomeCollections() {
  return (
    <div className={styles.collections}>
      <section className={styles.library} aria-labelledby="library-title">
        <header className={styles.collectionHeading}>
          <div>
            <h2 id="library-title"><Link href="/writing">Writing</Link></h2>
            <p>Essays on human nature, culture, and technology.</p>
          </div>
          <Link href="/writing" className={styles.archiveLink}>Browse all essays</Link>
        </header>

        <div className={styles.shelfScroll} role="region" aria-label="Essay bookshelf" tabIndex={0}>
          <ul className={styles.books}>
            {essays.map((essay) => {
              const jacket = jackets[essay.title];
              return <li key={essay.href}>
                <a
                  href={essay.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Read ${essay.title}`}
                  className={styles.book}
                >
                  <div className={`${styles.bookCover} ${jacket ? styles[jacket.design] : ""}`}>
                    <div className={styles.coverDesign} aria-hidden="true">
                      {jacket?.design === "spiral" && (
                        <svg viewBox="0 0 200 200" fill="none"><path d={spiralLine} stroke="currentColor" strokeWidth="0.7" /></svg>
                      )}
                    </div>
                    <h3 className={styles.bookTitle}>
                      {(jacket?.lines ?? [essay.title]).map((line, index) => <span key={index}>{line}{" "}</span>)}
                    </h3>
                    <span className={styles.bookAuthor}>Carter Wang</span>
                  </div>
                </a>
                <p className={styles.bookDescription}>{essay.subtitle}</p>
              </li>;
            })}
          </ul>
        </div>
        <p className={styles.shelfHint}>Swipe along the shelf to browse.</p>
      </section>

      <section className={styles.museum} aria-labelledby="museum-title">
        <header className={styles.collectionHeading}>
          <div>
            <h2 id="museum-title"><Link href="/projects">Projects</Link></h2>
            <p>Things I’ve built for fun.</p>
          </div>
          <Link href="/projects" className={styles.archiveLink}>Browse all projects</Link>
        </header>

        <ul className={styles.gallery} aria-label="Project gallery">
          {projects.map((project, index) => (
            <li key={project.href}>
              <a
                href={project.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-labelledby={`exhibit-${index}-title`}
                className={styles.exhibit}
              >
                <figure>
                  <div className={styles.artwork}>
                    <Image
                      src={project.image}
                      alt=""
                      fill
                      quality={86}
                      sizes="(max-width: 600px) calc(100vw - 48px), (max-width: 1000px) 44vw, 520px"
                    />
                  </div>
                  <figcaption><h3 id={`exhibit-${index}-title`}>{project.title}</h3></figcaption>
                </figure>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
