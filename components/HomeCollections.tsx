import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { essays, projects } from "@/content/portfolio";
import styles from "./HomeCollections.module.css";

const bindingHeights = [15.25, 14.5, 16, 15, 15.75, 14.75];

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
            {essays.map((essay, index) => (
              <li key={essay.href}>
                <a
                  href={essay.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Read ${essay.title}`}
                  className={styles.book}
                  style={{
                    "--binding": essay.spine.top,
                    "--binding-edge": essay.spine.bottom,
                    "--book-height": `${bindingHeights[index % bindingHeights.length]}rem`,
                  } as CSSProperties}
                >
                  <span className={styles.bookCover}>
                    <span className={styles.bookTitle}>{essay.title}</span>
                  </span>
                </a>
              </li>
            ))}
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
                  <div className={styles.frame}>
                    <div className={styles.mount}>
                      <div className={styles.artwork}>
                        <Image
                          src={project.image}
                          alt=""
                          fill
                          quality={86}
                          sizes="(max-width: 600px) calc((100vw - 88px) / 2), (max-width: 1000px) 28vw, 250px"
                        />
                      </div>
                    </div>
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
