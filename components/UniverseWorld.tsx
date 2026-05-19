import Link from "next/link";
import type { ReactNode } from "react";
import SiteNav from "./SiteNav";
import ScrollTransport from "./ScrollTransport";

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
      <>
        <p>
          Currently an associate at 886 Studios, a venture firm in Taipei founded by a group of
          Silicon Valley founders behind Twitch, Kabam, Guitar Hero, Playdom, EA Sports, HTC Vive,
          and others.
        </p>
        <p>
          I source, evaluate, and support early-stage startups through our ikigai Launchpad
          accelerator program.
        </p>
      </>
    ),
    cta: "See resume",
    href: "/work",
  },
  {
    id: "writing",
    title: "Writing",
    copy: (
      <p>
        Curious how human nature, culture, and technology intertwine to shape progress. Writing a
        Substack, <em>flying Arrows</em>.
      </p>
    ),
    cta: "Read writing",
    href: "/writing",
  },
  {
    id: "projects",
    title: "Projects",
    copy: <p>Currently learning how to vibe code. Just playing around and building things for fun.</p>,
    cta: "See projects",
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
          From SoCal, now in Taipei, working at 886 Studios with the founders of Twitch and Guitar
          Hero. Outside of work, I&apos;m usually watching the Lakers, playing poker, biking around
          Taipei, or writing.
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
      <ScrollTransport />
      <SiteNav />
      <main>
        <Hero />
        <div className="world-stack">
          {worlds.map((world) => (
            <WorldSection key={world.id} world={world} />
          ))}
        </div>
      </main>
      <nav className="section-dots" aria-label="Section shortcuts">
        {worlds.map((world, index) => (
          <a
            key={world.id}
            href={`#${world.id}`}
            aria-label={`Jump to ${world.title}`}
            className={index === 0 ? "active" : undefined}
          />
        ))}
      </nav>
    </div>
  );
}
