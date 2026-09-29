import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import GalaxyBackground from "@/components/GalaxyBackground";
import { siteConfig } from "@/lib/seo";
import { workPageBio, workPageExperience } from "@/content/portfolio";
import batchPhoto from "@/public/ikigai-batch.jpg";
import styles from "./WorkRoom.module.css";

const [current, ...earlier] = workPageExperience;
// Korobra is still running, so it sits "on the side" rather than "previously".
const previous = earlier.filter((item) => item.company !== "Korobra Capital");
const onTheSide = earlier.filter((item) => item.company === "Korobra Capital");

// Company marks, shown beside each name. They're decorative (the name is right
// there), and CSS tints them all the same cream so they read as one family.
const logos: Record<string, string> = {
  "886 Studios": "/logos/886-studios.png",
  "Contrary Research": "/logos/contrary.svg",
  "Slug Fund Investment Group": "/logos/slug-fund.svg",
  "Korobra Capital": "/logos/korobra-capital.png",
};

function Logo({ company, size }: { company: string; size: number }) {
  const src = logos[company];
  if (!src) return null;
  return <Image className={styles.logo} src={src} alt="" aria-hidden="true" width={size} height={size} unoptimized />;
}

function Out({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

// Written in Carter's first-person voice; every fact matches content/portfolio.ts.
// Program descriptions follow 886studios.com's own wording.
const highlights: { heading: string; story: ReactNode[] }[] = [
  {
    heading: "Building ikigai Launchpad",
    story: [
      <><Out href="https://886studios.com/programs">ikigai Launchpad</Out> is a 10-week, in-person accelerator in Taipei with $100K USD, mentor office hours, investor intros, and support beyond the batch.</>,
      "I was on the core team that created it. I helped shape how we pick teams, then worked with 15+ of them through workshops, office hours, and partnerships.",
    ],
  },
  {
    heading: "Finding founders",
    story: [
      <>I run deal sourcing for our <Out href="https://withikigai.com">accelerator</Out>. I&apos;ve screened and interviewed 350+ early-stage startups, gone deep on diligence with 100+ of them, and built the admissions process that decides who gets in.</>,
    ],
  },
  {
    heading: "Community & content",
    story: [
      <>I built <em><Out href="https://886studios.com/programs/launch-station">Launch Station</Out></em>, our residency for founders who move faster alongside ambitious peers, with 20+ founders. I host events for the wider community (hackathons, pitch nights, co-founder matching), run our socials, and rebuilt our <Out href="https://www.886studios.com/">website</Out>.</>,
      <>I also write our <Out href="https://886studios.substack.com/">newsletter</Out>.</>,
    ],
  },
];

type Earlier = (typeof earlier)[number];

// Shorter titles where the story already tells the progression.
const shortTitles: Record<string, string> = {
  "Slug Fund Investment Group": "Vice President",
};

// One-line stories for earlier roles; the full bullet details live on /resume.
function earlierStory(item: Earlier): ReactNode {
  switch (item.company) {
    case "Contrary Research": {
      const links = "links" in item && item.links ? item.links : [];
      return (
        <>
          I profiled and wrote deep dives on startups like{" "}
          {links.map((article, index) => (
            <span key={article.href}>
              {index > 0 ? (index === links.length - 1 ? ", and " : ", ") : null}
              <Out href={article.href}>{article.label}</Out>
            </span>
          ))}
          .
        </>
      );
    }
    case "Slug Fund Investment Group":
      return "UC Santa Cruz's student investment club. When leadership graduated during COVID and left a vacuum, I stepped up, revived the club, and revamped the whole thing. I went from equity analyst to head of the equity analyst team, then started a venture analyst team that wrote 15+ memos for a fantasy VC portfolio.";
    case "Korobra Capital":
      return "A fund I started in 2020 for family and friends. It's now $180K+, invested long term in AI, fintech, crypto, robotics, and more.";
    default:
      return null;
  }
}

function Experience({ item }: { item: Earlier }) {
  return (
    <li className={styles.experience}>
      <header className={styles.experienceHeading}>
        <h3><Logo company={item.company} size={26} />{item.company}</h3>
        <p className={styles.date}>{item.dates}</p>
        <p className={styles.role}>{shortTitles[item.company] ?? item.role}</p>
      </header>
      <p className={styles.story}>{earlierStory(item)}</p>
    </li>
  );
}

// Side work that lives on its own pages of the site.
const sideProjects: { title: string; story: string; link: { href: string; label: string } }[] = [
  {
    title: "Coding projects",
    story: "I build web apps and tools for fun. I've built TaipeiFlix for movie showtimes, Taipei Run (an endless runner on a moped), a sleep tracker app, a stock portfolio tracker, a poker odds calculator, and more.",
    link: { href: "/projects", label: "See my coding projects" },
  },
  {
    title: "Writing",
    story: "I write essays on Substack about technology, attention, identity, and work.",
    link: { href: "/writing", label: "Read my writing" },
  },
];

const aboutFacts = [
  { label: "Based in", value: "Taipei" },
  { label: "From", value: "Irvine, CA" },
  { label: "Studied at", value: "UC Santa Cruz" },
];

// The first two bio paragraphs repeat the 886 section, so About keeps the
// personal one.
const bioLead = workPageBio[2];

export default function WorkRoom() {
  return (
    <>
      <GalaxyBackground page />
      <main className={styles.main} data-work-desk>
        <div className={styles.desk}>
          <div className={styles.workHistory}>
            <section aria-labelledby="current-work-title">
              <header className={styles.intro}>
                <h1 id="current-work-title">
                  <Logo company={current.company} size={56} />
                  <a href="https://886studios.com/" target="_blank" rel="noopener noreferrer">{current.company}</a>
                </h1>
                <p className={styles.roleLine}>
                  <strong>{current.role}</strong> since October 2024, after starting as a Venture Fellow that summer
                </p>
              </header>
              <p className={styles.mission}>886 Studios is where the next generation of global tech companies are built. We run ikigai Launchpad, the premier Silicon Valley-style accelerator in Taipei, brought to you by the founders of Twitch, Guitar Hero, Playdom, Kabam, and more.</p>
              <div className={styles.contributions}>
                {highlights.map((item) => (
                  <div key={item.heading}>
                    <h2>{item.heading}</h2>
                    {item.story.map((line, index) => <p key={index}>{line}</p>)}
                  </div>
                ))}
              </div>
              <figure className={styles.photo}>
                <Image src={batchPhoto} alt="The ikigai Launchpad Spring '25 batch in matching 886 t-shirts, posed together in the office" sizes="(min-width: 761px) 736px, 100vw" quality={90} placeholder="blur" />
                <figcaption>ikigai Launchpad Spring &apos;25 batch</figcaption>
              </figure>
            </section>

            <section className={styles.earlier} aria-labelledby="earlier-work-title">
              <h2 id="earlier-work-title">Previously</h2>
              <ol className={styles.experiences}>
                {previous.map((item) => <Experience key={item.company} item={item} />)}
              </ol>
            </section>

            <section className={styles.side} aria-labelledby="side-work-title">
              <h2 id="side-work-title">On the side</h2>
              <ul className={styles.experiences}>
                {onTheSide.map((item) => <Experience key={item.company} item={item} />)}
                {sideProjects.map((item) => (
                  <li key={item.title} className={styles.experience}>
                    <header className={styles.experienceHeading}><h3>{item.title}</h3></header>
                    <p className={styles.story}>{item.story}</p>
                    <p className={styles.more}><Link href={item.link.href}>{item.link.label}</Link></p>
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.about} aria-labelledby="about-title">
              <h2 id="about-title">About me</h2>
              <dl className={styles.facts}>
                {aboutFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
              </dl>
              <p>{bioLead}</p>
            </section>

            <p className={styles.closing}>
              Building something? I&apos;d love to hear about it. <Out href={siteConfig.social.x}>Say hi</Out>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
