import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import GalaxyBackground from "@/components/GalaxyBackground";
import { siteConfig } from "@/lib/seo";
import { workPageBio, workPageExperience } from "@/content/portfolio";
import batchPhoto from "@/public/ikigai-batch.jpg";
import IslandLine from "./IslandLine";
import WorkArrival from "./WorkArrival";
import entry from "./WorkEntry.module.css";
import heading from "./PageHeading.module.css";
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
      "I was on the core team that created it. I helped shape how we pick teams, then worked with 15+ of them through workshops and partnerships.",
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

function WorkHeader({ preview = false }: { preview?: boolean }) {
  return (
    <header className={heading.header}>
      <div className={styles.title}>
        <h1 tabIndex={-1}>Work</h1>
        {!preview && <WorkArrival />}
      </div>
      <p><IslandLine id="work" /></p>
    </header>
  );
}

function CurrentWork({ preview = false }: { preview?: boolean }) {
  return (
    <section className={styles.section} aria-labelledby={preview ? undefined : "now-title"}>
      <h2 id={preview ? undefined : "now-title"} className={styles.label}>Now</h2>
      <div className={styles.body}>
        <header className={styles.experienceHeading}>
          <h3 className={styles.current}>
            <Logo company={current.company} size={36} />
            <a href="https://886studios.com/" target="_blank" rel="noopener noreferrer">{current.company}</a>
          </h3>
          <div className={styles.tenure}>
            <p className={styles.role}>{current.role}</p>
            <p className={styles.date}>{current.dates}</p>
          </div>
          <div className={styles.tenure}>
            <p className={styles.role}>Venture Fellow</p>
            <p className={styles.date}>June 2024 - September 2024</p>
          </div>
        </header>
        <p className={styles.mission}>886 Studios is where the next generation of global tech companies are built. I work alongside the founders of Twitch, Guitar Hero, Playdom, Kabam, and more.</p>
        <div className={styles.contributions}>
          {highlights.map((item) => (
            <div key={item.heading}>
              {item.story.map((line, index) => (
                <p key={index}>{index === 0 ? <><strong>{item.heading}.</strong>{" "}</> : null}{line}</p>
              ))}
            </div>
          ))}
        </div>
        {!preview && <figure className={styles.photo}>
          <Image src={batchPhoto} alt="The ikigai Launchpad Spring '25 batch gathered on the floor, smiling at the camera" sizes="(min-width: 761px) 736px, 100vw" quality={90} placeholder="blur" />
          <figcaption>ikigai Launchpad Spring &apos;25 batch</figcaption>
        </figure>}
      </div>
    </section>
  );
}

// Inert source for the carried window. The opening is rendered from the same
// components as /work, so the view through the glass matches its destination.
export function WorkWindowPreview() {
  return <div data-work-window-content hidden inert aria-hidden="true">
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.desk}>
          <WorkHeader preview />
          <div className={styles.workHistory}><CurrentWork preview /></div>
        </div>
      </div>
    </div>
  </div>;
}

export default function WorkRoom() {
  return (
    <>
      <GalaxyBackground page />
      <main className={styles.main} data-work-desk>
        <div className={`${styles.desk} ${entry.arrival}`} data-work-arrival>
          <WorkHeader />

          {/* Every section is the same shape: a title on the left, its content on the right. */}
          <div className={styles.workHistory}>
            <CurrentWork />

            <section className={styles.section} aria-labelledby="earlier-work-title">
              <h2 id="earlier-work-title" className={styles.label}>Previously</h2>
              <ol className={`${styles.body} ${styles.experiences}`}>
                {previous.map((item) => <Experience key={item.company} item={item} />)}
              </ol>
            </section>

            <section className={styles.section} aria-labelledby="side-work-title">
              <h2 id="side-work-title" className={styles.label}>On the side</h2>
              <ul className={`${styles.body} ${styles.experiences}`}>
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

            <section className={styles.section} aria-labelledby="about-title">
              <h2 id="about-title" className={styles.label}>About me</h2>
              <div className={`${styles.body} ${styles.about}`}>
                <dl className={styles.facts}>
                  {aboutFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
                </dl>
                <p>{bioLead}</p>
              </div>
            </section>

            <div className={styles.section}>
              <p className={`${styles.body} ${styles.closing}`}>
                Building something? I&apos;d love to hear about it. <Out href={siteConfig.social.x}>Say hi</Out>
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
