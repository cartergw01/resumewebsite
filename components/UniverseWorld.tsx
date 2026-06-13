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
    copy: <p>associate at <a href="https://886studios.com" target="_blank" rel="noopener noreferrer">886 Studios</a>, working on <a href="https://withikigai.com" target="_blank" rel="noopener noreferrer">ikigai Launchpad</a> in Taipei.</p>,
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
    copy: <p>fun projects i made.</p>,
    href: "/projects",
  },
];

function Hero() {
  return (
    <section className="cosmic-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">Carter Wang</h1>
        <p>working in Taipei at 886 Studios alongside the founders of Twitch and Guitar Hero, backing early-stage startups. writing and building things for fun on the side.</p>
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
      {/* Desktop: whole-card click target. Hidden on mobile (globals.css) so only
          the asset and title are tappable — small screens don't need a big hitarea. */}
      <Link href={world.href} className="world-card-hitarea" aria-labelledby={headingId} />
      <span className="world-orb" aria-hidden="true">
        <span className="world-visual" aria-hidden="true" />
        {/* Mobile tap target over the island art (aria-hidden — title link carries the name) */}
        <Link href={world.href} className="world-orb-link" tabIndex={-1} aria-hidden="true" />
      </span>
      <div className="world-intro">
        <h2 id={headingId}>
          <Link href={world.href} className="world-title-link">{world.title}</Link>
        </h2>
        <div className="world-copy">{world.copy}</div>
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
