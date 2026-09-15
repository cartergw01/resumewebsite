import Image from "next/image";
import SiteNav from "./SiteNav";
import IslandScrollTransport from "./IslandScrollTransport";
import IslandLink from "./IslandLink";
import WritingIsland from "./WritingIsland";
import styles from "./IslandHome.module.css";

const worlds = [
  { id: "work", title: "Work", prompt: "learn about my work", image: "/world-work-cutout-v1.webp", width: 960, height: 540 },
  { id: "writing", title: "Writing", prompt: "read my writing", image: "/world-writing-cutout-v1.webp", width: 960, height: 529 },
  { id: "projects", title: "Projects", prompt: "see what I’ve built", image: "/world-projects-cutout-v2.webp", width: 960, height: 616 },
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
              {world.id === "writing" ? <WritingIsland /> : <IslandLink href={`/${world.id}`} title={world.title} prompt={world.prompt}>
                <Image
                  src={world.image}
                  alt=""
                  width={world.width}
                  height={world.height}
                  sizes="(max-width: 760px) 100vw, 68vw"
                  priority={index === 0}
                  loading={index === 0 ? undefined : "eager"}
                  unoptimized
                  draggable={false}
                  className={styles.island}
                  data-island-visual
                />
              </IslandLink>}
            </div>
          </section>
        ))}
      </IslandScrollTransport>
    </div>
  );
}
