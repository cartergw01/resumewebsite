"use client";

import { Accordion, AccordionItem, Card, CardBody, Image, Link } from "@heroui/react";
import { motion } from "framer-motion";

const topLinks = [
  { label: "Email", href: "mailto:cartergw01@gmail.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/cartergrantwang" },
  { label: "Substack", href: "https://carterko.substack.com/" },
  { label: "X", href: "https://x.com/CarterKoWang" },
];

const profileFacts = [
  { label: "Based In", value: "Taipei" },
  { label: "From", value: "Irvine, California" },
  { label: "Education", value: "UC Santa Cruz, Business Management Economics" },
];

const skills =
  "Notion, Google Workspace, Canva, ChatGPT, Claude, various AI tools, Microsoft Office, investment analysis, writing, copywriting, Substack, social media marketing (X, Instagram, LinkedIn, Threads, Discord), community building, and event planning.";

const interests =
  "poker, reading, traveling, snowboarding, playing basketball, watching the Lakers, biking, and writing.";

const bio = [
  "Hey, I'm Carter! I grew up in Southern California, studied Business Management Economics at UC Santa Cruz, and am now living in Taipei working as an associate at 886 Studios alongside the founders of Twitch and Guitar Hero.",
  "We're building an accelerator that backs and supports early-stage startups, bringing a slice of Silicon Valley to Asia. Before that, I was a Research Fellow at Contrary Research, where I profiled and wrote about leading startups.",
  "Outside of work, you'll usually find me watching the Lakers, playing poker, biking around the city, or writing.",
];

const experience = [
  {
    company: "886 Studios",
    role: "Venture Associate",
    dates: "October 2024 - Present",
    details: [
      "Lead deal sourcing for a new accelerator by screening and interviewing 250+ early-stage startups, running diligence on 100+ companies, and building the admissions and interview flow in Notion and Tally.",
      "Serve on the core team that launched ikigai Launchpad in Taiwan, helping shape the selection rubric and supporting 15+ batch teams through workshops, office hours, investor matching, partnerships, and corporate perks.",
      "Spearhead Launch Station, a community-building program for founders, and manage newsletters, socials, website updates, events, and Demo Day planning.",
    ],
  },
  {
    company: "Contrary Research",
    role: "Research Fellow",
    dates: "March 2023 - March 2024",
    details: [
      "Conducted in-depth research and analysis on a wide range of technology companies, with a focus on startups.",
      "Authored comprehensive investment memos that distilled complex information into clear, concise, and compelling analysis.",
      "Collaborated with a team of writers and editors to help advance the development of Contrary Research.",
    ],
    links: [
      { label: "Shield AI", href: "https://research.contrary.com/company/shield-ai" },
      { label: "SpaceX", href: "https://research.contrary.com/company/spacex" },
      { label: "Turo", href: "https://research.contrary.com/company/turo" },
      { label: "Chime", href: "https://research.contrary.com/company/chime/" },
      { label: "Hive", href: "https://research.contrary.com/company/hive" },
    ],
  },
  {
    company: "Slug Fund Investment Group",
    role: "Equity Research Analyst -> Vice President & Head of the Venture Analyst Team",
    dates: "January 2021 - July 2023",
    details: [
      "Performed fundamental research on public companies and supported the development of investment theses.",
      "Contributed to written reports and stock pitches presented within the fund.",
      "Assisted in restructuring the club, recruiting, managing projects and presentations, and leading meetings and discussions.",
      "Created and led a team of venture analysts that researched early-stage companies and developed 15+ investment memos for a fantasy VC portfolio.",
      "Led equity analysts that performed due diligence, developed in-depth research reports, and presented stock pitches.",
    ],
  },
  {
    company: "Korobra Capital",
    role: "Portfolio Manager",
    dates: "November 2020 - Present",
    details: [
      "Established a fund as a wealth-creation vehicle for family and friends with $180K+ in assets under management.",
      "Construct and monitor a long-term investment portfolio across high-growth industries including AI, fintech, crypto, robotics, digital media, autonomous vehicles, and e-commerce.",
    ],
  },
];

const essays = [
  { title: "Slop & Spiral", href: "https://carterko.substack.com/" },
  { title: "We All Have Superpowers", href: "https://carterko.substack.com/p/we-all-have-superpowers" },
  { title: "The Mirage of Identity", href: "https://carterko.substack.com/p/the-mirage-of-identity" },
  { title: "From Crash to Curiosity", href: "https://carterko.substack.com/p/from-crash-to-curiosity" },
  { title: "Work as Play", href: "https://carterko.substack.com/p/work-as-play" },
];

const sectionMotion = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export default function PortfolioHome() {
  const featuredExperience = experience[0];
  const earlierExperience = experience.slice(1);

  return (
    <main className="portfolio-shell overflow-hidden px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <div className="accent-halo left-[-10rem] top-8 h-72 w-72 bg-[var(--blue-glow)]" />
      <div className="accent-halo right-[-5rem] top-24 h-64 w-64 bg-[var(--accent-soft)]" />
      <div className="portfolio-grid pointer-events-none absolute inset-x-0 top-0 h-[34rem]" />

      <div className="mx-auto flex max-w-6xl justify-end py-2">
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-xs tracking-[0.16em] text-[var(--muted)]">
          {topLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              target={item.href.startsWith("mailto:") ? undefined : "_blank"}
              rel={item.href.startsWith("mailto:") ? undefined : "noreferrer"}
              className="text-[var(--foreground)] no-underline transition-opacity hover:opacity-80"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <motion.section
        className="mx-auto mt-2 grid max-w-6xl items-start gap-3 lg:grid-cols-[1.08fr_0.92fr]"
        initial={false}
        animate="show"
        variants={sectionMotion}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="grid gap-3">
          <Card className="portfolio-card-strong rounded-[30px] border-none shadow-none">
            <CardBody className="gap-3 p-5 sm:p-6">
              <h1 className="text-4xl font-semibold text-[var(--foreground)] sm:text-6xl">Carter Wang</h1>
              <div className="grid gap-2 text-sm leading-8 text-[var(--muted)] sm:text-base">
                {bio.map((paragraph) => (
                  <p key={paragraph} className="max-w-5xl">
                    {paragraph}
                  </p>
                ))}
              </div>
            </CardBody>
          </Card>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Card className="timeline-featured rounded-[26px] border shadow-none">
              <CardBody className="gap-3 p-5">
                <div>
                  <h2 className="text-2xl font-semibold text-[var(--foreground)]">{featuredExperience.company}</h2>
                  <p className="mt-1 text-sm tracking-[0.12em] text-[var(--muted)]">{featuredExperience.role}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{featuredExperience.dates}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Venture Fellow · June 2024 - September 2024</p>
                </div>
                <ul className="grid gap-2 text-sm leading-7 text-[var(--foreground)]">
                  {featuredExperience.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-[0.7rem] h-2.5 w-2.5 shrink-0 rotate-45 border-r border-t border-[var(--accent-strong)]"
                      />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </motion.div>

          <motion.div
            className="h-full"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          >
            <Card className="portfolio-card-archive h-full rounded-[26px] border-none shadow-none">
              <CardBody className="flex h-full flex-col gap-4 p-5">
                <div>
                  <h2 className="text-2xl font-semibold text-[var(--foreground)]">Earlier Experience</h2>
                </div>
                <Accordion
                  variant="splitted"
                  selectionMode="multiple"
                  defaultExpandedKeys={["Contrary Research-Research Fellow"]}
                  className="grow px-0"
                  itemClasses={{
                    base: "bg-transparent px-0 py-0 shadow-none data-[open=true]:bg-transparent",
                    heading: "px-0",
                    trigger: "items-start gap-4 px-0 py-4 text-left",
                    title: "text-base font-semibold text-[var(--foreground)]",
                    subtitle: "text-sm text-[var(--muted)]",
                    content: "px-0 pt-0 pb-2",
                    indicator: "text-[var(--accent)]",
                  }}
                >
                  {earlierExperience.map((item) => (
                    <AccordionItem
                      key={`${item.company}-${item.role}`}
                      aria-label={`${item.company} ${item.role}`}
                      title={item.company}
                      subtitle={`${item.role}  •  ${item.dates}`}
                      indicator={({ isOpen }) => (
                        <span
                          className={`text-[var(--accent)] transition-transform duration-200 ${isOpen ? "rotate-90" : "rotate-0"}`}
                        >
                          &gt;
                        </span>
                      )}
                    >
                      <div className="pl-8">
                        <ul className="grid gap-2 border-t border-[var(--line)] pt-4 text-sm leading-7 text-[var(--foreground)]">
                          {item.details.map((detail) => (
                            <li key={detail} className="flex items-start gap-3">
                              <span
                                aria-hidden="true"
                                className="mt-[0.7rem] h-2.5 w-2.5 shrink-0 rotate-45 border-r border-t border-[var(--accent-strong)]"
                              />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                        {"links" in item && item.links ? (
                          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--line)] pt-4 text-sm">
                            {item.links.map((article) => (
                              <Link
                                key={article.href}
                                href={article.href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--foreground)] underline decoration-[var(--accent)]/60 underline-offset-4 transition-opacity hover:opacity-75"
                              >
                                {article.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardBody>
            </Card>
          </motion.div>
        </div>

        <div className="grid gap-3">
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Card className="portfolio-card-profile rounded-[30px] border-none shadow-none">
              <CardBody className="gap-5 p-5 pt-3 sm:p-6 sm:pt-4">
                <Image
                  removeWrapper
                  alt="Carter Wang headshot"
                  src="/headshot.jpg"
                  className="relative -top-2 h-[20rem] w-full rounded-[22px] object-cover object-[center_12%]"
                />
                <div className="grid gap-4">
                  {profileFacts.map((fact) => (
                    <div key={fact.label} className="border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0">
                      <p className="text-[10px] tracking-[0.16em] text-[var(--muted)]">{fact.label}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">{fact.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3">
                  <p className="text-[10px] tracking-[0.16em] text-[var(--muted)]">Skills</p>
                  <p className="text-sm leading-7 text-[var(--foreground)]">{skills}</p>
                </div>
                <div className="grid gap-3">
                  <p className="text-[10px] tracking-[0.16em] text-[var(--muted)]">Interests</p>
                  <p className="text-sm leading-7 text-[var(--foreground)]">{interests}</p>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          <motion.div className="content-fade">
            <Card className="portfolio-paper relative overflow-hidden rounded-[26px] border-none shadow-none">
              <div className="pointer-events-none absolute right-[-3rem] top-6 h-28 w-28 rounded-full bg-[rgba(255,168,103,0.22)] blur-3xl" />
              <CardBody className="relative flex h-full flex-col gap-4 p-5 lg:p-6">
                <div>
                  <h2 className="text-2xl font-semibold text-[var(--foreground)]">Essays</h2>
                  <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
                    I&apos;m fascinated by how technology, culture, and human nature intertwine to shape progress.
                  </p>
                </div>
                <div className="essay-list rounded-[18px]">
                  {essays.map((essay, index) => (
                    <motion.div
                      key={essay.title}
                      initial={{ opacity: 0, x: 12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.35 }}
                      transition={{ delay: index * 0.04, duration: 0.25, ease: "easeOut" }}
                    >
                      <Link
                        href={essay.href}
                        target="_blank"
                        rel="noreferrer"
                        className="essay-row flex min-h-[3.75rem] items-center justify-between gap-4 border-b border-[var(--line)] py-3 text-sm text-[var(--foreground)] no-underline transition-opacity hover:opacity-75"
                      >
                        <span>{essay.title}</span>
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--accent)]/45 bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]"
                        >
                          -&gt;
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </motion.section>
    </main>
  );
}
