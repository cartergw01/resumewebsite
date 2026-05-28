import Link from "next/link";
import type { ReactNode } from "react";
import SiteNav from "./SiteNav";
import ScrollTransport from "./ScrollTransport";
import { RocketCursor } from "./RocketCursor";

type World = {
  id: "work" | "writing" | "projects";
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
      <a href="#work" className="scroll-cue" aria-label="Scroll down to Work">
        <span>Scroll down</span>
        <span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}

function SectionIntro({ world, headingId }: { world: World; headingId: string }) {
  return (
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
  );
}

function WorldSection({ world }: { world: (typeof worlds)[number] }) {
  const headingId = `${world.id}-heading`;

  return (
    <section id={world.id} className={`world-section world-${world.id}`} aria-labelledby={headingId}>
      <SectionIntro world={world} headingId={headingId} />
      <div className="world-visual" aria-hidden="true" />
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
        <div className="world-stack">
          {worlds.map((world) => (
            <WorldSection key={world.id} world={world} />
          ))}
        </div>
      </main>
    </div>
  );
}
