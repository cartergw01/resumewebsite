import Image from "next/image";
import Link from "next/link";
import { essays, projects } from "@/content/portfolio";
import styles from "./HomeCollections.module.css";

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
            {essays.map((essay) => (
              <li key={essay.href}>
                <a
                  href={essay.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Read ${essay.title}`}
                  className={styles.book}
                >
                  <figure>
                    <div className={styles.bookCover}>
                      <Image
                        src={essay.image}
                        alt=""
                        quality={86}
                        sizes="(max-width: 600px) min(264px, calc(100vw - 72px)), 320px"
                      />
                    </div>
                    <figcaption><h3 className={styles.bookTitle}>{essay.title}</h3></figcaption>
                  </figure>
                </a>
                <p className={styles.bookDescription}>{essay.subtitle}</p>
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
