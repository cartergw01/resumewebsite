"use client";

import { motion } from "framer-motion";
import SiteNav from "@/components/SiteNav";

const roles = [
  {
    company: "886 Studios",
    role: "Venture Associate",
    period: "Oct 2024 - Present",
    location: "Taipei",
    blurb:
      "I help source startups, evaluate companies, support accelerator teams, and run founder-facing programs between Taiwan and Silicon Valley.",
    bullets: [
      "Screened and interviewed 250+ startups for the accelerator pipeline.",
      "Helped select and support 15+ ikigai Launchpad teams through workshops, office hours, investor matching, and Demo Day.",
      "Lead Launch Station, newsletters, events, website updates, and founder communications.",
    ],
  },
  {
    company: "Contrary Research",
    role: "Research Fellow",
    period: "Mar 2023 - Mar 2024",
    location: "Remote",
    blurb:
      "Wrote in-depth company research on technology businesses, turning technical and market complexity into clear investment thinking.",
    links: [
      { label: "Shield AI", href: "https://research.contrary.com/company/shield-ai" },
      { label: "SpaceX", href: "https://research.contrary.com/company/spacex" },
      { label: "Turo", href: "https://research.contrary.com/company/turo" },
      { label: "Chime", href: "https://research.contrary.com/company/chime/" },
      { label: "Hive", href: "https://research.contrary.com/company/hive" },
    ],
  },
  {
    company: "Slug Fund",
    role: "VP & Head of Venture",
    period: "Jan 2021 - Jul 2023",
    location: "UC Santa Cruz",
    blurb:
      "Built the venture analyst team, led student investment research, and helped analysts turn curiosity into structured company research.",
  },
  {
    company: "Korobra Capital",
    role: "Portfolio Manager",
    period: "Nov 2020 - Present",
    location: "Personal fund",
    blurb:
      "A long-term personal investment fund focused on AI, fintech, crypto, robotics, digital media, autonomous vehicles, and e-commerce.",
  },
];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export default function WorkPage() {
  return (
    <div className="cosmic-subpage subpage-work subpage-topic">
      <SiteNav active="work" />

      <main className="subpage-main">
        <motion.header className="subpage-hero" {...fade(0)}>
          <span>Work</span>
          <h1>Venture work and founder community.</h1>
          <p>
            I work with early-stage companies by sourcing startups, evaluating markets,
            writing research, and helping founders move between Taiwan and Silicon Valley.
          </p>
        </motion.header>

        <div className="subpage-layout">
          <motion.aside className="subpage-world-art" aria-hidden="true" {...fade(0.08)} />

          <section className="subpage-panel-list work-history" aria-label="Work history">
            {roles.map((role, index) => (
              <motion.article className="subpage-panel" key={role.company} {...fade(0.1 + index * 0.06)}>
                <div className="panel-kicker">
                  <span>{role.period}</span>
                  <span>{role.location}</span>
                </div>
                <h2>{role.company}</h2>
                <h3>{role.role}</h3>
                <p>{role.blurb}</p>
                {role.bullets && (
                  <ul>
                    {role.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
                {role.links && (
                  <div className="panel-links">
                    {role.links.map((link) => (
                      <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </motion.article>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
