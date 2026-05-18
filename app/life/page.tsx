"use client";

import { motion } from "framer-motion";
import SiteNav from "@/components/SiteNav";

const notes = [
  ["Home base", "Taipei, Taiwan", "Originally from Irvine, California."],
  ["Game", "Poker", "Texas Hold'em. Cash games mostly."],
  ["Team", "Lakers", "Through thick and thin."],
  ["Sport", "Basketball", "Playing, not just watching."],
  ["Getting around", "Biking", "My favorite way to see Taipei."],
  ["Reading", "Always", "Biographies, essays, and books about technology and how we live."],
];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export default function LifePage() {
  return (
    <div className="cosmic-subpage subpage-life subpage-topic">
      <SiteNav active="life" />

      <main className="subpage-main">
        <motion.header className="subpage-hero" {...fade(0)}>
          <span>Life</span>
          <h1>The life around the work.</h1>
          <p>
            I grew up in Southern California, went to UC Santa Cruz, and now live in Taipei.
            I bike around the city, play poker, watch the Lakers, read, and write things down.
          </p>
        </motion.header>

        <div className="subpage-layout subpage-layout-reverse">
          <motion.aside className="subpage-world-art" aria-hidden="true" {...fade(0.08)} />

          <div>
            <section className="life-grid" aria-label="Life notes">
              {notes.map(([label, value, sub], index) => (
                <motion.article className="life-note" key={label} {...fade(0.1 + index * 0.06)}>
                  <span>{label}</span>
                  <h2>{value}</h2>
                  <p>{sub}</p>
                </motion.article>
              ))}
            </section>

            <motion.article className="subpage-panel subpage-note" {...fade(0.52)}>
              <div className="panel-kicker">
                <span>Currently in</span>
                <span>Taipei</span>
              </div>
              <p>
                Taipei rewards wandering: great food, dense energy, easy living, and night markets
                that make ordinary evenings feel like small adventures.
              </p>
            </motion.article>
          </div>
        </div>
      </main>
    </div>
  );
}
