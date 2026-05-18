"use client";

import { motion } from "framer-motion";
import SiteNav from "@/components/SiteNav";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const projectSlots = Array.from({ length: 6 }, (_, index) => index + 1);

export default function ProjectsPage() {
  return (
    <div className="cosmic-subpage subpage-projects subpage-topic">
      <SiteNav active="projects" />

      <main className="subpage-main projects-main">
        <motion.header className="subpage-hero projects-hero" {...fade(0)}>
          <span>Projects</span>
          <h1>Projects</h1>
        </motion.header>

        <div className="subpage-layout">
          <motion.aside className="subpage-world-art" aria-hidden="true" {...fade(0.08)} />

          <section className="project-grid" aria-label="Project grid">
            {projectSlots.map((slot, index) => (
              <motion.div
                aria-hidden="true"
                className="project-slot"
                key={slot}
                {...fade(0.1 + index * 0.04)}
              />
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
