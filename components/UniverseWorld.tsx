import Link from "next/link";
import type { ReactNode } from "react";
import SiteNav from "./SiteNav";
import ScrollTransport from "./ScrollTransport";
import { RocketCursor } from "./RocketCursor";

type World = {
  id: "work" | "writing" | "projects" | "life";
  title: string;
  copy: ReactNode;
  cta: string;
  href: string;
};

const worlds: World[] = [
  {
    id: "work",
    title: "Work",
    copy: (
      <p>Associate at 886 Studios. We run ikigai Launchpad, the premier Silicon Valley accelerator in Taipei.</p>
    ),
    cta: "view work",
    href: "/work",
  },
  {
    id: "writing",
    title: "Writing",
    copy: (
      <p>
        Essays on human nature, culture, and technology. I write{" "}
        <a href="https://carterko.substack.com/" target="_blank" rel="noopener noreferrer">
          <em>flying Arrows</em>
        </a>
        .
      </p>
    ),
    cta: "read essays",
    href: "/writing",
  },
  {
    id: "projects",
    title: "Projects",
    copy: (
      <p>Learning to vibe code and building fun projects for fun.</p>
    ),
    cta: "see projects",
    href: "/projects",
  },
  {
    id: "life",
    title: "Life",
    copy: (
      <p>
        Taipei days, SoCal roots, Lakers, poker, books, bikes, and notes from wandering around the
        city.
      </p>
    ),
    cta: "see life",
    href: "/life",
  },
];

function Hero() {
  return (
    <section className="cosmic-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">Carter Wang</h1>
        <div className="title-star" aria-hidden="true" />
        <p>
          <span>
            From SoCal, now in Taipei, working as an associate at 886 Studios with the founders of
            Twitch and Guitar Hero.
          </span>
          {" "}
          <span>
            Outside of work, I&apos;m usually watching the Lakers, playing poker, biking around
            Taipei, or writing.
          </span>
        </p>
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
    <article id={world.id} className={`constellation-node world-${world.id}`}>
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
      <Link href={world.href}>
        {world.cta} <span aria-hidden="true">→</span>
      </Link>
      </div>
    </article>
  );
}

function ConstellationMap() {
  return (
    <section id="constellation" className="constellation-map" aria-labelledby="constellation-title">
      <div className="constellation-heading">
        <span>Worlds</span>
        <h2 id="constellation-title">A few places to land.</h2>
      </div>
      <div className="constellation-stage" aria-label="Explore Carter's work, writing, projects, and life">
        <div className="constellation-thread" aria-hidden="true" />
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
      <RocketCursor />
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
