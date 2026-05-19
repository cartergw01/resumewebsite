import SiteNav from "./SiteNav";
import ScrollTransport from "./ScrollTransport";
import SpaceDrift from "./SpaceDrift";

const worlds = [
  {
    id: "work",
    title: "Work",
    copy: "Startups, research, and founder programs between Taipei and Silicon Valley.",
    cta: "See work",
    href: "/work",
  },
  {
    id: "writing",
    title: "Writing",
    copy: "Essays on technology, identity, markets, and growing up online.",
    cta: "Read writing",
    href: "/writing",
  },
  {
    id: "projects",
    title: "Projects",
    copy: "Small tools, experiments, and half-formed ideas I want to make real.",
    cta: "See projects",
    href: "/projects",
  },
  {
    id: "life",
    title: "Life",
    copy: "Taipei, bikes, basketball, poker, books, and notes from ordinary days.",
    cta: "Life notes",
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
          From SoCal, now in Taipei, working at 886 Studios with the founders of Twitch and Guitar
          Hero. Outside of startups, I&apos;m usually watching the Lakers, playing poker, biking around
          the city, or writing.
        </p>
      </div>
      <div className="hero-visual" aria-hidden="true" />
    </section>
  );
}

function SectionIntro({ world, headingId }: { world: (typeof worlds)[number]; headingId: string }) {
  return (
    <div className="world-intro">
      <h2 id={headingId}>{world.title}</h2>
      <p>{world.copy}</p>
      <a href={world.href}>
        {world.cta} <span aria-hidden="true">→</span>
      </a>
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
      <SpaceDrift />
      <SiteNav homeAnchors />
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
