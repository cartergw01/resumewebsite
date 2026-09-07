import Image from "next/image";
import Link from "next/link";
import { essays, projects } from "@/content/portfolio";
import rooftop from "@/public/taipei-rooftop-v1.png";
import SiteNav from "./SiteNav";
import styles from "./UniverseWorld.module.css";

const featuredEssay = essays.find((essay) => essay.title === "Work as Play") ?? essays[0];
const featuredProject = projects[0];

const destinations = [
  { id: "work", title: "Work", context: "Startups & venture", preview: "886 Studios · Taipei", href: "/work" },
  { id: "writing", title: "Writing", context: "flying Arrows", preview: featuredEssay.title, href: "/writing" },
  { id: "projects", title: "Projects", context: "fun projects i made.", preview: featuredProject.title, href: "/projects" },
] as const;

export default function UniverseWorld() {
  return (
    <div className={styles.home}>
      <SiteNav />
      <main className={styles.main}>
        <header className={styles.intro}>
          <p className={styles.location}>
            <span className={styles.locationMark} aria-hidden="true" />
            Based in Taipei
          </p>
          <h1>Carter Wang</h1>
          <div className={styles.bio}>
            <p>
              working in Taipei at <a href="https://886studios.com" target="_blank" rel="noopener noreferrer">886 Studios</a> alongside the founders of Twitch and Guitar Hero, backing early-stage startups.
            </p>
            <p>writing and building things for fun on the side.</p>
          </div>
          <a href="#constellation" className={styles.explore}>
            Explore the rooftop <span aria-hidden="true">↓</span>
          </a>
        </header>

        <section className={styles.scene} aria-label="Explore Carter's rooftop">
          <div className={styles.art}>
            <Image
              src={rooftop}
              alt="A lamp-lit writing desk and basketball court share a rooftop above Earth, overlooking the Taipei skyline."
              fill
              priority
              quality={86}
              sizes="(max-width: 900px) 120vw, (max-aspect-ratio: 1/1) 120vw, (max-aspect-ratio: 16/9) 178vh, 100vw"
              className={styles.image}
            />
            <div className={`${styles.glow} ${styles.writingGlow}`} aria-hidden="true" />
            <div className={`${styles.glow} ${styles.projectsGlow}`} aria-hidden="true" />
            <div className={`${styles.glow} ${styles.workGlow}`} aria-hidden="true" />
          </div>

          <nav id="constellation" className={styles.destinations} aria-label="Explore work, writing, and projects">
            {destinations.map((destination, index) => (
              <Link
                key={destination.id}
                href={destination.href}
                className={`${styles.destination} ${styles[destination.id]}`}
                data-rooftop-destination={destination.id}
                aria-labelledby={`${destination.id}-title`}
                aria-describedby={`${destination.id}-preview`}
              >
                <span className={styles.index} aria-hidden="true">0{index + 1}</span>
                <span className={styles.destinationBody}>
                  <span className={styles.context}>{destination.context}</span>
                  <span className={styles.titleRow}>
                    <span id={`${destination.id}-title`} className={styles.title}>{destination.title}</span>
                    <span className={styles.arrow} aria-hidden="true">↗</span>
                  </span>
                  <span id={`${destination.id}-preview`} className={styles.preview}>
                    {destination.preview}<span aria-hidden="true"> →</span>
                  </span>
                </span>
                <span className={styles.pin} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </section>
      </main>
    </div>
  );
}
