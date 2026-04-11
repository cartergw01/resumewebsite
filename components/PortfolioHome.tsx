"use client";

import { useEffect, useRef } from "react";
import { Accordion, AccordionItem, Card, CardBody, Link } from "@heroui/react";
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
  { title: "Slop & Spiral", subtitle: "We numb our minds and eventually our souls, and yet we are stimulated. For we have found not the fountain of living water, but the abyss of infinite cheap dopamine.", href: "https://carterko.substack.com/p/slop-and-spiral" },
  { title: "We All Have Superpowers", subtitle: "We invent technology to extend ourselves", href: "https://carterko.substack.com/p/we-all-have-superpowers" },
  { title: "The Mirage of Identity", subtitle: "Our social world in the 21st century", href: "https://carterko.substack.com/p/the-mirage-of-identity" },
  { title: "From Crash to Curiosity", subtitle: "My Investing adVENTURE, thus far…", href: "https://carterko.substack.com/p/from-crash-to-curiosity" },
  { title: "Work as Play", subtitle: "A reflection on the cusp of my career", href: "https://carterko.substack.com/p/work-as-play" },
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

    // Warp is driven purely by scroll position — smoothly lerped each frame.
    // Scrolling down increases warp (more hyperspace), scrolling up decreases it.
    let smoothWarp = 0;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const getScrollDepth = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return clamp(window.scrollY / maxScroll, 0, 1);
    };

    // Realistic star color palette — temperature-based (O/B blue to M red)
    const palette: [number, number, number][] = [
      [155, 176, 255],  // O/B type — blue
      [170, 191, 255],  // B type — blue-white
      [202, 215, 255],  // A type — white-blue
      [248, 247, 255],  // F type — pure white
      [255, 244, 234],  // G type — yellow-white
      [255, 222, 180],  // K type — yellow-orange
      [255, 190, 130],  // K/M type — orange
      [255, 160, 100],  // M type — deep orange-red
    ];

    interface Star {
      x: number; y: number;
      size: number; driftSpeed: number;
      baseOpacity: number; phase: number; twinkleSpeed: number;
      cr: number; cg: number; cb: number;
      prominent: boolean;
      alpha: number; // fade-in multiplier 0→1, so center-spawned stars appear smoothly
    }

    // 4 parallax layers: [count, minSz, maxSz, minSpd, maxSpd, minOp, maxOp]
    const layers: [number, number, number, number, number, number, number][] = [
      [380, 0.15, 0.5,  0.02,  0.055, 0.35, 0.7],   // far — dense field
      [160, 0.4,  1.1,  0.065, 0.18,  0.6,  0.9],   // mid
      [65,  0.9,  2.2,  0.18,  0.43,  0.8,  1.0],   // near
      [14,  2.0,  3.8,  0.08,  0.20,  0.95, 1.0],   // prominent
    ];

    const stars: Star[] = [];
    for (const [count, minSz, maxSz, minSpd, maxSpd, minOp, maxOp] of layers) {
      const isProminent = minSz >= 2.0;
      for (let i = 0; i < count; i++) {
        // Bias prominent/near stars toward cooler colors for variety
        const paletteIdx = isProminent
          ? Math.floor(Math.random() * palette.length)
          : Math.floor(Math.random() * palette.length);
        const [cr, cg, cb] = palette[paletteIdx];
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: minSz + Math.random() * (maxSz - minSz),
          driftSpeed: minSpd + Math.random() * (maxSpd - minSpd),
          baseOpacity: minOp + Math.random() * (maxOp - minOp),
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.0003 + Math.random() * 0.0015,
          cr, cg, cb,
          prominent: isProminent,
          alpha: 1,
        });
      }
    }

    const resetStar = (star: Star, fromCenter = false) => {
      if (fromCenter) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * Math.min(W, H) * 0.08;
        star.x = W / 2 + Math.cos(angle) * radius;
        star.y = H / 2 + Math.sin(angle) * radius;
        star.alpha = 0; // fade in so they don't pop
      } else {
        star.x = W + star.size + Math.random() * W * 0.12;
        star.y = Math.random() * H;
        star.alpha = 1;
      }
      star.phase = Math.random() * Math.PI * 2;
    };

    // Nebulae — vivid, punchy
    const nebulae = [
      { x: W * 0.15, y: H * 0.3,  r: 340, cr: 90,  cg: 20,  cb: 200, a: 0.22, vx: 0.035,  vy: 0.018 },
      { x: W * 0.75, y: H * 0.65, r: 380, cr: 15,  cg: 60,  cb: 220, a: 0.24, vx: -0.028, vy: 0.025 },
      { x: W * 0.5,  y: H * 0.08, r: 300, cr: 210, cg: 25,  cb: 100, a: 0.18, vx: 0.02,   vy: -0.014 },
      { x: W * 0.88, y: H * 0.38, r: 320, cr: 25,  cg: 110, cb: 230, a: 0.20, vx: -0.038, vy: 0.018 },
      { x: W * 0.38, y: H * 0.82, r: 280, cr: 140, cg: 10,  cb: 210, a: 0.16, vx: 0.022,  vy: -0.012 },
      { x: W * 0.62, y: H * 0.45, r: 260, cr: 220, cg: 90,  cb: 20,  a: 0.12, vx: -0.018, vy: 0.030 },
    ];

    interface Shooter { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; }
    const shooters: Shooter[] = [];
    let lastShot = 0;
    let nextDelay = 1500 + Math.random() * 2500;

    const getNextShotDelay = (warpVal: number) => {
      const rate = clamp(1 - warpVal * 0.75, 0.1, 1);
      return 800 * rate + Math.random() * 1500 * rate;
    };

    const spawnShooters = (warpVal: number) => {
      const burstCount = 1 + Math.floor(warpVal * 1.5);
      for (let i = 0; i < burstCount; i++) {
        const angle = (8 + Math.random() * 30) * (Math.PI / 180);
        const spd = 12 + Math.random() * 8 + warpVal * 10;
        shooters.push({
          x: Math.random() * W * 0.7,
          y: Math.random() * H * 0.5,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 0,
          maxLife: 45 + Math.random() * 30,
        });
      }
    };

    const draw = (t: number) => {
      // Smoothly lerp warp toward actual scroll depth.
      // Rate 0.032 ≈ ~500ms settle time — feels deliberate, not twitchy.
      const targetWarp = getScrollDepth();
      smoothWarp += (targetWarp - smoothWarp) * 0.032;
      const warp = smoothWarp;
      const cx = W / 2, cy = H / 2;

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
        g.addColorStop(0.5, `rgba(${n.cr},${n.cg},${n.cb},${n.a * 0.4})`);
        g.addColorStop(1, `rgba(${n.cr},${n.cg},${n.cb},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Stars — drift left, wrap, twinkle
      for (const s of stars) {
        // Fade in stars that were just spawned from center
        s.alpha = Math.min(1, s.alpha + 0.018);

        const dx = s.x - cx;
        const dy = s.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        // Lateral drift fades out as warp increases — at full warp all motion is clean radial
        const lateralDrift = s.driftSpeed * (1 - warp * 0.92);
        const radialPush = warp * warp * (0.5 + warp * 1.0) * s.driftSpeed * 7;

        s.x -= lateralDrift;
        s.x += nx * radialPush;
        s.y += ny * radialPush * 0.72;

        const margin = 24;
        if (s.x < -margin || s.x > W + margin || s.y < -margin || s.y > H + margin) {
          resetStar(s, warp > 0.15);
        }

        // Twinkle fades out during hyperspace — streaking stars should glow steadily
        const twinkleMix = Math.max(0, 1 - warp * 1.4);
        const twinkle = twinkleMix > 0
          ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.phase)) * twinkleMix + (1 - twinkleMix) * 0.55
          : 0.85;
        const op = s.baseOpacity * twinkle * s.alpha;

        // Outer glow for all stars with size > 0.8
        if (s.size > 0.8) {
          const glowR = s.size * (s.prominent ? 6 : 4);
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
          g.addColorStop(0, `rgba(${s.cr},${s.cg},${s.cb},${op * 0.4})`);
          g.addColorStop(1, `rgba(${s.cr},${s.cg},${s.cb},0)`);
          ctx.beginPath();
          ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }

        if (warp > 0.05) {
          if (dist < 8) continue; // only skip stars literally at the vanishing point
          // Smooth near-center fade instead of hard cutoff — streaks grow naturally from center
          const nearFade = Math.min(dist / 32, 1);
          const distFactor = Math.min(dist / 180, 1) * nearFade;
          const streakLen = warp * warp * 80 * (s.size + 0.5) * distFactor;
          const sg = ctx.createLinearGradient(
            s.x - nx * streakLen, s.y - ny * streakLen, s.x, s.y
          );
          sg.addColorStop(0, `rgba(${s.cr},${s.cg},${s.cb},0)`);
          sg.addColorStop(0.55, `rgba(${s.cr},${s.cg},${s.cb},${op * 0.3})`);
          sg.addColorStop(1, `rgba(${s.cr},${s.cg},${s.cb},${op})`);
          ctx.beginPath();
          ctx.moveTo(s.x - nx * streakLen, s.y - ny * streakLen);
          ctx.lineTo(s.x, s.y);
          ctx.strokeStyle = sg;
          ctx.lineWidth = s.size * (0.6 + warp * 0.8);
          ctx.stroke();
        }
        // Dot shrinks to nothing at full warp (replaced by streak)
        const dotR = s.size * Math.max(0, 1 - warp * 0.9);
        if (dotR > 0.05) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, dotR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${op})`;
          ctx.fill();
        }
      }

      // Shooting stars
      if (t - lastShot > nextDelay) {
        lastShot = t;
        nextDelay = getNextShotDelay(warp);
        if (warp > 0.05) spawnShooters(warp);
      }

      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        const op = Math.sin((s.life / s.maxLife) * Math.PI);
        const tailLen = 28 + warp * 20;
        const g = ctx.createLinearGradient(s.x - s.vx * tailLen, s.y - s.vy * tailLen, s.x, s.y);
        g.addColorStop(0, "rgba(200,220,255,0)");
        g.addColorStop(0.7, `rgba(220,235,255,${op * 0.5})`);
        g.addColorStop(1, `rgba(245,250,255,${op})`);
        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * tailLen, s.y - s.vy * tailLen);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${op})`;
        ctx.fill();
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        if (s.life >= s.maxLife) shooters.splice(i, 1);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    // Pause when tab is hidden — no point burning CPU for a hidden canvas
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else {
        animId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
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
    <div style={{ perspective: 900 }} className="h-full">
      <motion.div
        className="h-full"
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
    <h1 className="text-4xl font-bold text-[var(--foreground)] sm:text-6xl">
      Carter Wang
    </h1>
  );
}

function MouseGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      el.style.background = `radial-gradient(650px circle at ${e.clientX}px ${e.clientY}px, rgba(88, 130, 255, 0.06), transparent 65%)`;
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }} />;
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

const rowVariants = {
  rest: { y: 0 },
  hover: { y: -3, transition: { duration: 0.2, ease: "easeOut" as const } },
} as const;
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
  hover: { x: 4, transition: { duration: 0.18, ease: "easeOut" as const } },
};
const rowArrowVariants = {
  rest: { opacity: 0, x: -6 },
  hover: { opacity: 1, x: 0, transition: { duration: 0.18, ease: "easeOut" as const } },
};
const rowSubtitleVariants = {
  rest: { opacity: 0, height: 0, marginTop: 0 },
  hover: { opacity: 1, height: "auto", marginTop: 3, transition: { duration: 0.22, ease: "easeOut" as const } },
};

function EssayRow({ essay, index }: { essay: { title: string; subtitle: string; href: string }; index: number }) {
  return (
    <motion.a
      href={essay.href}
      target="_blank"
      rel="noreferrer"
      initial="rest"
      whileHover="hover"
      variants={rowVariants}
      className="relative flex items-center gap-4 rounded-xl border border-transparent px-3 py-[1rem] no-underline cursor-pointer overflow-hidden"
      style={{ boxShadow: "none" }}
    >
      {/* hover background */}
      <motion.span
        variants={rowBgVariants}
        className="pointer-events-none absolute inset-0 rounded-xl bg-[var(--accent-soft)]"
      />
      {/* left accent bar */}
      <motion.span
        variants={rowBarVariants}
        style={{ originY: 0 }}
        className="pointer-events-none absolute left-0 top-0 h-full w-[2px] rounded-l-xl bg-[var(--accent)]"
      />
      {/* index */}
      <span className="relative z-10 w-7 shrink-0 text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)] select-none">
        {index + 1}
      </span>
      {/* title + subtitle */}
      <div className="relative z-10 flex-1 min-w-0">
        <motion.span
          variants={rowTitleVariants}
          className="block text-sm font-semibold leading-6 text-[var(--foreground)]"
        >
          {essay.title}
        </motion.span>
        <motion.span
          variants={rowSubtitleVariants}
          className="block overflow-hidden text-xs leading-5 text-[var(--muted)]"
        >
          {essay.subtitle}
        </motion.span>
      </div>
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

function ScrollReveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20, filter: "blur(5px)" }}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortfolioHome() {
  const featuredExperience = experience[0];
  const earlierExperience = experience.slice(1);

  return (
    <>
    <StarField />
    <MouseGlow />
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

      {/* Top row: bio + photo — CSS grid stretch makes them equal height */}
      <div className="mx-auto mt-2 grid max-w-6xl items-stretch gap-2 sm:gap-3 lg:grid-cols-[1.08fr_0.92fr]">
        <ScrollReveal delay={0.05} className="h-full">
          <TiltCard>
            <Card className="portfolio-card-strong h-full rounded-[30px] border-none shadow-none">
              <CardBody className="flex h-full flex-col justify-start gap-2 p-4 sm:p-5">
                <AnimatedName />
                <div className="grid gap-2 text-sm leading-[1.7] text-[var(--muted)]">
                  {bio.map((paragraph) => (
                    <p key={paragraph} className="max-w-5xl">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardBody>
            </Card>
          </TiltCard>
        </ScrollReveal>

        <div className="min-h-0 overflow-hidden">
          <ScrollReveal delay={0.05} className="h-full">
            <TiltCard>
              <div className="portfolio-card-profile flex h-full items-center rounded-[30px] p-4 sm:p-5">
                <div className="relative h-full min-h-[220px] w-full overflow-hidden rounded-[22px] sm:min-h-[280px] lg:min-h-0">
                  <img
                    alt="Carter Wang headshot"
                    src="/headshot.jpg"
                    className="absolute inset-0 block h-full w-full object-cover object-[center_25%]"
                  />
                </div>
              </div>
            </TiltCard>
          </ScrollReveal>
        </div>
      </div>

      <div className="mx-auto mt-3 grid max-w-6xl items-start gap-3 lg:items-stretch lg:grid-cols-[1.08fr_0.92fr]">
        {/* Left column */}
        <div className="grid gap-3 lg:h-full lg:grid-rows-[auto_1fr]">

          <ScrollReveal delay={0.08}>
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
          </ScrollReveal>

          <ScrollReveal className="h-full">
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
          </ScrollReveal>
        </div>

        {/* Right column */}
        <div className="grid gap-3 lg:h-full lg:grid-rows-[auto_1fr]">
          {/* Photo card */}
          {/* Essays card */}
          <ScrollReveal delay={0.1}>
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
                  <div className="mt-1 flex flex-col gap-1">
                    {essays.map((essay, index) => (
                      <EssayRow key={essay.title} essay={essay} index={index} />
                    ))}
                  </div>

                  {/* Footer — hover highlight matches essay rows */}
                  <div className="mt-2 border-t border-[var(--line)] pt-2">
                    <motion.a
                      href="https://carterko.substack.com/"
                      target="_blank"
                      rel="noreferrer"
                      initial="rest"
                      whileHover="hover"
                      variants={rowVariants}
                      className="relative flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 no-underline cursor-pointer overflow-hidden"
                      style={{ boxShadow: "none" }}
                    >
                      <motion.span variants={rowBgVariants} className="pointer-events-none absolute inset-0 rounded-xl bg-[var(--accent-soft)]" />
                      <motion.span variants={rowBarVariants} style={{ originY: 0 }} className="pointer-events-none absolute left-0 top-0 h-full w-[2px] rounded-l-xl bg-[var(--accent)]" />
                      <span className="relative z-10 flex-1 text-[11px] tracking-[0.14em] text-[var(--muted)]">
                        Read more on Substack
                      </span>
                      <motion.span variants={rowArrowVariants} className="relative z-10 shrink-0 text-base text-[var(--accent)]" aria-hidden="true">→</motion.span>
                    </motion.a>
                  </div>

                </CardBody>
              </Card>
            </TiltCard>
          </ScrollReveal>

          {/* Skills / Interests card */}
          <ScrollReveal className="h-full">
            <TiltCard>
              <Card className="portfolio-card-profile h-full rounded-[30px] border-none shadow-none">
                <CardBody className="flex h-full flex-col gap-5 p-5 sm:p-6">
                  <div className="grid gap-4">
                    {profileFacts.map((fact) => (
                      <div key={fact.label} className="border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0">
                        <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">{fact.label}</p>
                        <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">{fact.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3">
                    <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">Skills</p>
                    <p className="text-sm leading-[1.75] text-[var(--foreground)]">{skills}</p>
                  </div>
                  <div className="grid gap-3">
                    <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">Interests</p>
                    <p className="text-sm leading-[1.75] text-[var(--foreground)]">{interests}</p>
                  </div>
                </CardBody>
              </Card>
            </TiltCard>
          </ScrollReveal>
        </div>
      </div>
    </main>
    </>
  );
}
