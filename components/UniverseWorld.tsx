import Link from "next/link";
import type { ReactNode } from "react";
import SiteNav from "./SiteNav";
import ScrollTransport from "./ScrollTransport";

type World = {
  id: "work" | "writing" | "projects";
  title: string;
  copy: ReactNode;
  href: string;
};

const worlds: World[] = [
  {
    id: "work",
    title: "Work",
    copy: <p>associate at 886 Studios, working on ikigai Launchpad in Taipei.</p>,
    href: "/work",
  },
  {
    id: "writing",
    title: "Writing",
    copy: (
      <p>
        essays on human nature, culture, and technology at{" "}
        <a href="https://carterko.substack.com/" target="_blank" rel="noopener noreferrer">
          <em>flying Arrows</em>
        </a>
        .
      </p>
    ),
    href: "/writing",
  },
  {
    id: "projects",
    title: "Projects",
    copy: <p>vibe-coded experiments, tools, and playful web projects.</p>,
    href: "/projects",
  },
];

function Hero() {
  return (
    <section className="cosmic-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">Carter Wang</h1>
        <p>Working in Taipei at 886 Studios alongside the founders of Twitch and Guitar Hero, backing early-stage startups. Writing and building things for fun on the side.</p>
      </div>
      <div className="hero-visual" aria-hidden="true" />
      <a href="#constellation" className="scroll-cue" aria-label="Scroll down to the constellation map">
        <span>Scroll down</span>
        <span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}

function ConstellationNode({ world }: { world: World }) {
  const headingId = `${world.id}-heading`;

  return (
    <article id={world.id} className={`world-card world-${world.id}`}>
      <Link href={world.href} className="world-orb" aria-labelledby={headingId}>
        <span className="world-visual" aria-hidden="true" />
      </Link>
      <div className="world-intro">
        <h2 id={headingId}>
          <Link href={world.href} className="world-title-link">
            {world.title}
          </Link>
        </h2>
        <div className="world-copy">{world.copy}</div>
        <span className="world-enter-cue" aria-hidden="true">Enter →</span>
      </div>
    </article>
  );
}

function ConstellationMap() {
  return (
    <section id="constellation" className="constellation-map" aria-labelledby="constellation-title">
      <div className="constellation-heading">
        <span>Worlds</span>
        <h2 id="constellation-title">Choose a world.</h2>
      </div>
      <div className="world-gallery" aria-label="Explore Carter's work, writing, and projects">
        {worlds.map((world) => (
          <ConstellationNode key={world.id} world={world} />
        ))}
      </div>
    </section>
  );
}

export default function UniverseWorld() {
  return (
    <div className="cosmic-home">
      <ScrollTransport />
      <div className="cosmic-sky" aria-hidden="true">
        <div className="star-depth star-depth-far" />
        <div className="star-depth star-depth-mid" />
        <div className="star-depth star-depth-near" />
      </div>
      <SiteNav />
      <main>
        <Hero />
        <ConstellationMap />
      </main>
    </div>
  );
}
