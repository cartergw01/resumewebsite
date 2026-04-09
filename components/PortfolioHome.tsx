"use client";

import { useEffect, useRef, useState } from "react";
import { Accordion, AccordionItem, Card, CardBody, Image, Link } from "@heroui/react";
import { motion, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";

const topLinks = [
  { label: "X", href: "https://x.com/CarterKoWang" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/cartergrantwang" },
  { label: "Email", href: "mailto:cartergw01@gmail.com" },
  { label: "Substack", href: "https://carterko.substack.com/" },
];

const profileFacts = [
  { label: "Based In", value: "Taipei" },
  { label: "From", value: "Irvine, California" },
  { label: "Education", value: "UC Santa Cruz, Business Management Economics" },
];

const skills =
  "Notion, Google Workspace, Canva, ChatGPT, Claude, various AI tools, Microsoft Office, investment analysis, writing, copywriting, Substack, social media marketing (X, Instagram, LinkedIn, Threads, Discord), community building, and event planning.";

const interests =
  "Writing, poker, playing basketball, reading, traveling, watching the Lakers, snowboarding, and biking";

const bio = [
  "Hey, I'm Carter! I grew up in Southern California, studied Business Management Economics at UC Santa Cruz, and am now living in Taipei working as an associate at 886 Studios alongside the founders of Twitch and Guitar Hero.",
  "We're building an accelerator that backs and supports early-stage startups, bringing a slice of Silicon Valley to Asia. Before that, I was a Research Fellow at Contrary Research, where I profiled and wrote about leading startups.",
  "Outside of work, you'll usually find me watching the Lakers, playing poker, biking around the city, or writing.",
];

const keyStats = [
  { value: 250, suffix: "+", label: "Startups Screened" },
  { value: 15, suffix: "+", label: "Portfolio Companies" },
  { value: 180, suffix: "K+", label: "AUM" },
];

const experience = [
  {
    company: "886 Studios",
    role: "Venture Associate",
    dates: "October 2024 - Present",
    details: [
      "Lead deal sourcing for a new accelerator. Screen and interview 250+ early-stage startups, own the full application pipeline from inbound through review, run diligence on 100+ startups, design and manage the admissions process, and contribute to final selection decisions.",
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener("resize", onResize);

    // Star color palette — blue-white to faint purple
    const palette: [number, number, number][] = [
      [210, 228, 255],
      [200, 215, 255],
      [225, 215, 255],
      [235, 235, 255],
    ];

    interface Star {
      x: number; y: number;
      size: number; driftSpeed: number;
      baseOpacity: number; phase: number; twinkleSpeed: number;
      cr: number; cg: number; cb: number;
    }

    // Build 3 parallax layers: [count, minSz, maxSz, minSpd, maxSpd, minOp, maxOp]
    const layers: [number, number, number, number, number, number, number][] = [
      [150, 0.2, 0.55, 0.02,  0.055, 0.18, 0.5],   // far
      [75,  0.5, 1.1,  0.065, 0.18,  0.4,  0.75],  // mid
      [28,  1.0, 2.2,  0.18,  0.43,  0.65, 1.0],   // near
    ];

    const stars: Star[] = [];
    for (const [count, minSz, maxSz, minSpd, maxSpd, minOp, maxOp] of layers) {
      for (let i = 0; i < count; i++) {
        const [cr, cg, cb] = palette[Math.floor(Math.random() * palette.length)];
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: minSz + Math.random() * (maxSz - minSz),
          driftSpeed: minSpd + Math.random() * (maxSpd - minSpd),
          baseOpacity: minOp + Math.random() * (maxOp - minOp),
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.0004 + Math.random() * 0.001,
          cr, cg, cb,
        });
      }
    }

    // Drifting nebula patches — large blurry color clouds
    const nebulae = [
      { x: W * 0.15, y: H * 0.3,  r: 230, cr: 80,  cg: 30,  cb: 170, a: 0.055, vx: 0.035,  vy: 0.018 },
      { x: W * 0.75, y: H * 0.65, r: 270, cr: 25,  cg: 65,  cb: 190, a: 0.065, vx: -0.028, vy: 0.025 },
      { x: W * 0.5,  y: H * 0.08, r: 200, cr: 170, cg: 35,  cb: 110, a: 0.038, vx: 0.02,   vy: -0.014 },
      { x: W * 0.88, y: H * 0.38, r: 250, cr: 35,  cg: 110, cb: 210, a: 0.048, vx: -0.038, vy: 0.018 },
      { x: W * 0.38, y: H * 0.82, r: 210, cr: 100, cg: 20,  cb: 180, a: 0.035, vx: 0.022,  vy: -0.012 },
    ];

    interface Shooter { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; }
    const shooters: Shooter[] = [];
    let lastShot = 0;
    let nextDelay = 1500 + Math.random() * 2500;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);

      // Nebulae — drift and wrap
      for (const n of nebulae) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -n.r) n.x = W + n.r;
        if (n.x > W + n.r) n.x = -n.r;
        if (n.y < -n.r) n.y = H + n.r;
        if (n.y > H + n.r) n.y = -n.r;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, `rgba(${n.cr},${n.cg},${n.cb},${n.a})`);
        g.addColorStop(1, `rgba(${n.cr},${n.cg},${n.cb},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Stars — drift left, wrap, twinkle
      for (const s of stars) {
        s.x -= s.driftSpeed;
        if (s.x < -s.size * 2) {
          s.x = W + s.size;
          s.y = Math.random() * H;
        }

        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.phase));
        const op = s.baseOpacity * twinkle;

        // Soft glow for larger/brighter stars
        if (s.size > 1.1) {
          const glowR = s.size * 4;
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
          g.addColorStop(0, `rgba(${s.cr},${s.cg},${s.cb},${op * 0.35})`);
          g.addColorStop(1, `rgba(${s.cr},${s.cg},${s.cb},0)`);
          ctx.beginPath();
          ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${op})`;
        ctx.fill();
      }

      // Shooting stars
      if (t - lastShot > nextDelay) {
        lastShot = t;
        nextDelay = 1500 + Math.random() * 2500;
        const angle = (10 + Math.random() * 30) * (Math.PI / 180);
        const spd = 14 + Math.random() * 10;
        shooters.push({
          x: Math.random() * W * 0.7,
          y: Math.random() * H * 0.5,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 0,
          maxLife: 50 + Math.random() * 25,
        });
      }

      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        const op = Math.sin((s.life / s.maxLife) * Math.PI);
        const g = ctx.createLinearGradient(s.x - s.vx * 14, s.y - s.vy * 14, s.x, s.y);
        g.addColorStop(0, "rgba(200,220,255,0)");
        g.addColorStop(1, `rgba(230,240,255,${op * 0.9})`);
        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * 14, s.y - s.vy * 14);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        if (s.life >= s.maxLife) shooters.splice(i, 1);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
    />
  );
}

function TiltCard({ children }: { children: React.ReactNode }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), { stiffness: 300, damping: 30 });

  return (
    <div style={{ perspective: 900 }}>
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          x.set((e.clientX - rect.left) / rect.width - 0.5);
          y.set((e.clientY - rect.top) / rect.height - 0.5);
        }}
        onMouseLeave={() => {
          x.set(0);
          y.set(0);
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function AnimatedName() {
  return (
    <h1 className="text-4xl font-semibold text-[var(--foreground)] sm:text-6xl">
      {"Carter Wang".split(" ").map((word, i) => (
        <motion.span
          key={word}
          initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.3 + i * 0.18, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block mr-[0.3em] last:mr-0"
        >
          {word}
        </motion.span>
      ))}
    </h1>
  );
}

function MagneticLink({ label, href }: { label: string; href: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 500, damping: 28 });
  const springY = useSpring(y, { stiffness: 500, damping: 28 });

  return (
    <motion.a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
      style={{ x: springX, y: springY, display: "inline-block" }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left - rect.width / 2) * 0.4);
        y.set((e.clientY - rect.top - rect.height / 2) * 0.4);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className="text-[var(--foreground)] no-underline transition-opacity hover:opacity-80 cursor-pointer"
    >
      {label}
    </motion.a>
  );
}

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let startTime = 0;
    const duration = 1400;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * to));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, to]);

  return <span ref={ref}>{count}{suffix}</span>;
}

const rowVariants = { rest: {}, hover: {} } as const;
const rowBgVariants = {
  rest: { opacity: 0 },
  hover: { opacity: 1, transition: { duration: 0.18 } },
} as const;
const rowBarVariants = {
  rest: { scaleY: 0 },
  hover: { scaleY: 1, transition: { duration: 0.22, ease: "easeOut" as const } },
};
const rowTitleVariants = {
  rest: { x: 0 },
  hover: { x: 5, transition: { duration: 0.18, ease: "easeOut" as const } },
};
const rowArrowVariants = {
  rest: { opacity: 0, x: -8 },
  hover: { opacity: 1, x: 0, transition: { duration: 0.18, ease: "easeOut" as const } },
};

function EssayRow({ essay, index }: { essay: { title: string; href: string }; index: number }) {
  return (
    <motion.a
      href={essay.href}
      target="_blank"
      rel="noreferrer"
      initial="rest"
      whileHover="hover"
      variants={rowVariants}
      className="relative flex items-center gap-4 border-b border-[var(--line)] py-[1.1rem] last:border-b-0 no-underline cursor-pointer overflow-hidden"
    >
      {/* hover background wash */}
      <motion.span
        variants={rowBgVariants}
        className="pointer-events-none absolute inset-0 bg-[var(--accent-soft)]"
      />
      {/* left accent bar */}
      <motion.span
        variants={rowBarVariants}
        style={{ originY: 0 }}
        className="pointer-events-none absolute left-0 top-0 h-full w-[2px] bg-[var(--accent)]"
      />
      {/* index number */}
      <span className="relative z-10 w-7 shrink-0 text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)] select-none">
        {String(index + 1).padStart(2, "0")}
      </span>
      {/* title */}
      <motion.span
        variants={rowTitleVariants}
        className="relative z-10 flex-1 text-sm font-semibold leading-6 text-[var(--foreground)]"
      >
        {essay.title}
      </motion.span>
      {/* arrow */}
      <motion.span
        variants={rowArrowVariants}
        className="relative z-10 shrink-0 text-base text-[var(--accent)]"
        aria-hidden="true"
      >
        →
      </motion.span>
    </motion.a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortfolioHome() {
  const featuredExperience = experience[0];
  const earlierExperience = experience.slice(1);

  return (
    <>
    <StarField />
    <main className="portfolio-shell relative overflow-hidden px-4 pb-12 pt-5 sm:px-6 lg:px-8" style={{ zIndex: 1 }}>
      <div className="accent-halo accent-halo-1 left-[-10rem] top-8 h-72 w-72 bg-[var(--blue-glow)]" />
      <div className="accent-halo accent-halo-2 right-[-5rem] top-24 h-64 w-64 bg-[var(--accent-soft)]" />

      <div className="mx-auto flex max-w-6xl justify-end py-2">
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-xs tracking-[0.16em] text-[var(--muted)]">
          {topLinks.map((item, i) => (
            <motion.span
              key={item.label}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.07, duration: 0.4, ease: "easeOut" }}
            >
              <MagneticLink label={item.label} href={item.href} />
            </motion.span>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-2 grid max-w-6xl items-start gap-3 lg:grid-cols-[1.08fr_0.92fr]">
        {/* Left column */}
        <div className="grid gap-3">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <TiltCard>
              <Card className="portfolio-card-strong rounded-[30px] border-none shadow-none">
                <CardBody className="gap-3 p-5 sm:p-6">
                  <AnimatedName />
                  <div className="grid gap-2 text-sm leading-7 text-[var(--muted)]">
                    {bio.map((paragraph) => (
                      <p key={paragraph} className="max-w-5xl">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </TiltCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <TiltCard>
              <Card className="timeline-featured rounded-[26px] border shadow-none">
                <CardBody className="gap-3 p-5">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold text-[var(--foreground)]">{featuredExperience.company}</h2>
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">Associate</p>
                      <p className="shrink-0 text-sm text-[var(--muted)]">{featuredExperience.dates}</p>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm text-[var(--muted)]">Venture Fellow</p>
                      <p className="shrink-0 text-sm text-[var(--muted)]">June 2024 - September 2024</p>
                    </div>
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
            </TiltCard>
          </motion.div>

          <motion.div
            className="h-full"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <TiltCard>
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
                      title: "text-sm font-semibold text-[var(--foreground)]",
                      subtitle: "text-sm text-[var(--muted)]",
                      content: "px-0 pt-0 pb-2",
                      indicator: "flex h-6 w-6 shrink-0 items-center justify-center self-center text-[var(--accent)]",
                    }}
                  >
                    {earlierExperience.map((item) => (
                      <AccordionItem
                        key={`${item.company}-${item.role}`}
                        aria-label={`${item.company} ${item.role}`}
                        title={
                          <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                            <span className="text-sm font-semibold text-[var(--foreground)]">{item.company}</span>
                            <span className="shrink-0 text-sm font-normal text-[var(--muted)] sm:text-right">
                              {item.dates}
                            </span>
                          </div>
                        }
                        subtitle={item.role}
                        indicator={({ isOpen }) => (
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center text-[var(--accent)] transition-transform duration-200 ${isOpen ? "rotate-90" : "rotate-0"}`}
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
            </TiltCard>
          </motion.div>
        </div>

        {/* Right column */}
        <div className="grid gap-3">
          <motion.div
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <TiltCard>
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
            </TiltCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <TiltCard>
              <Card className="portfolio-paper relative overflow-hidden rounded-[26px] border-none shadow-none">
                <div className="pointer-events-none absolute right-[-3rem] top-6 h-28 w-28 rounded-full bg-[rgba(255,168,103,0.22)] blur-3xl" />
                <CardBody className="relative flex h-full flex-col p-5 lg:p-6">

                  {/* Header */}
                  <div className="mb-1">
                    <h2 className="text-2xl font-semibold text-[var(--foreground)]">Essays</h2>
                    <div className="mt-3 h-px bg-[var(--line)]" />
                  </div>

                  {/* Essay rows */}
                  <div className="mt-2 flex flex-col">
                    {essays.map((essay, index) => (
                      <EssayRow key={essay.title} essay={essay} index={index} />
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="mt-4 border-t border-[var(--line)] pt-4">
                    <Link
                      href="https://carterko.substack.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] tracking-[0.16em] text-[var(--muted)] no-underline transition-colors hover:text-[var(--accent)]"
                    >
                      Read more on my Substack →
                    </Link>
                  </div>

                </CardBody>
              </Card>
            </TiltCard>
          </motion.div>
        </div>
      </div>
    </main>
    </>
  );
}
