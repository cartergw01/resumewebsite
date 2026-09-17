import SiteNav from "./SiteNav";
import IslandScrollTransport from "./IslandScrollTransport";
import LivingIsland from "./LivingIsland";
import WritingIsland from "./WritingIsland";
import { essays, projects } from "@/content/portfolio";
import styles from "./IslandHome.module.css";

const worlds = [
  { id: "work", title: "Work" },
  { id: "writing", title: "Writing" },
  { id: "projects", title: "Projects" },
] as const;

export default function IslandHome() {
  return (
    <div className={styles.home}>
      <SiteNav hidePrimary />
      <IslandScrollTransport worlds={worlds.map(({ id, title }) => ({ id, title }))}>
        {worlds.map((world, index) => (
          <section
            key={world.id}
            id={world.id}
            className={`${styles.scene} ${styles[world.id]}`}
            data-island-scene
            data-active={index === 0}
            aria-labelledby={index === 0 ? "hero-title" : `${world.id}-heading`}
            aria-hidden={index !== 0}
            inert={index !== 0}
          >
            <div className={styles.copy} data-scene-copy>
              {index === 0 ? (
                <>
                  <h1 id="hero-title">Carter Wang</h1>
                  <p className={styles.description}>
                    working in Taipei at <a href="https://886studios.com" target="_blank" rel="noopener noreferrer">886 Studios</a> alongside the founders of Twitch and Guitar Hero, backing early-stage startups. writing and building things for fun on the side.
                  </p>
                </>
              ) : (
                <>
                  <h2 id={`${world.id}-heading`}>{world.title}</h2>
                  <p className={styles.description}>
                    {world.id === "writing" ? (
                      <>essays on human nature, culture, and technology at <a href="https://carterko.substack.com/" target="_blank" rel="noopener noreferrer"><em>flying Arrows</em></a>.</>
                    ) : "fun projects i made."}
                  </p>
                </>
              )}
            </div>
            <div className={styles.art} data-scene-art>
              {world.id === "writing" ? <WritingIsland essay={{ title: essays[0].title, subtitle: essays[0].subtitle, date: essays[0].date, href: essays[0].href }} /> : <LivingIsland world={world.id} preview={world.id === "projects" ? projects[0]?.image : undefined} />}
            </div>
          </section>
        ))}
      </IslandScrollTransport>
    </div>
  );
}
