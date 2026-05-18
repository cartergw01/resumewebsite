"use client";

import { motion } from "framer-motion";
import SiteNav from "./SiteNav";
import ScrollTransport from "./ScrollTransport";

const worlds = [
  {
    id: "work",
    title: "Work",
    copy: "Working with early-stage founders between Taiwan and Silicon Valley.",
    cta: "View work",
    href: "/work",
  },
  {
    id: "writing",
    title: "Writing",
    copy: "Essays on technology, culture, identity, markets, and human potential.",
    cta: "Read essays",
    href: "/writing",
  },
  {
    id: "projects",
    title: "Projects",
    copy: "Small tools and experiments for writing, focus, and workflow automation.",
    cta: "View projects",
    href: "/projects",
  },
  {
    id: "life",
    title: "Life",
    copy: "Taipei notes, basketball, biking, books, poker, and everyday curiosity.",
    cta: "About life",
    href: "/life",
  },
];

function Hero() {
  return (
    <section className="cosmic-hero" aria-labelledby="hero-title">
      <motion.div
        className="hero-copy"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 id="hero-title">Carter Wang</h1>
        <div className="title-star" aria-hidden="true" />
        <p>Writing, building, and investing around technology, culture, and human potential.</p>
      </motion.div>
      <motion.div
        className="hero-visual"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      />
    </section>
  );
}

function SectionIntro({ world }: { world: (typeof worlds)[number] }) {
  return (
    <motion.div
      className="world-intro"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2>{world.title}</h2>
      <p>{world.copy}</p>
      <a href={world.href}>
        {world.cta} <span aria-hidden="true">→</span>
      </a>
    </motion.div>
  );
}

function WorldSection({ world }: { world: (typeof worlds)[number] }) {
  return (
    <section id={world.id} className={`world-section world-${world.id}`}>
      <SectionIntro world={world} />
      <motion.div
        className="world-visual"
        aria-hidden="true"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
      />
    </section>
  );
}

export default function UniverseWorld() {
  return (
    <div className="cosmic-home">
      <ScrollTransport />
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
