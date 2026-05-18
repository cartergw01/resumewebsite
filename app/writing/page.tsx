"use client";

import { motion } from "framer-motion";
import SiteNav from "@/components/SiteNav";

const essays = [
  {
    title: "Slop & Spiral",
    subtitle:
      "What infinite feeds do to attention, taste, and the part of us that still wants depth.",
    href: "https://carterko.substack.com/p/slop-and-spiral",
    tag: "Technology / Society",
  },
  {
    title: "We All Have Superpowers",
    subtitle: "How technology extends our minds, changes our limits, and reshapes what we expect from ourselves.",
    href: "https://carterko.substack.com/p/we-all-have-superpowers",
    tag: "Technology / Human potential",
  },
  {
    title: "The Mirage of Identity",
    subtitle: "How online life turns the self into something performed, edited, and constantly compared.",
    href: "https://carterko.substack.com/p/the-mirage-of-identity",
    tag: "Identity / Culture",
  },
  {
    title: "From Crash to Curiosity",
    subtitle: "How losing money in the markets became a lasting obsession with how the world works.",
    href: "https://carterko.substack.com/p/from-crash-to-curiosity",
    tag: "Investing / Personal",
  },
  {
    title: "Work as Play",
    subtitle: "A reflection on choosing work that feels alive, demanding, and worth getting better at.",
    href: "https://carterko.substack.com/p/work-as-play",
    tag: "Work / Meaning",
  },
];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export default function WritingPage() {
  return (
    <div className="cosmic-subpage subpage-writing subpage-topic">
      <SiteNav active="writing" />

      <main className="subpage-main">
        <motion.header className="subpage-hero" {...fade(0)}>
          <span>Writing</span>
          <h1>Essays for thinking in public.</h1>
          <p>
            I write about technology, identity, culture, markets, and what it means to grow up
            while the world keeps accelerating.
          </p>
        </motion.header>

        <div className="subpage-layout subpage-layout-reverse">
          <motion.aside className="subpage-world-art" aria-hidden="true" {...fade(0.08)} />

          <section className="essay-grid" aria-label="Selected essays">
            {essays.map((essay, index) => (
              <motion.a
                className="essay-card"
                key={essay.title}
                href={essay.href}
                target="_blank"
                rel="noreferrer"
                {...fade(0.1 + index * 0.06)}
              >
                <span>{essay.tag}</span>
                <h2>{essay.title}</h2>
                <p>{essay.subtitle}</p>
              </motion.a>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
