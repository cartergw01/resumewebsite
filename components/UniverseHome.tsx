"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from "framer-motion";
import StarField from "./StarField";

// ─── Scroll → warp curve ──────────────────────────────────────────────────────
// Three smooth bell-curve peaks between each world. Warp = 0 at each destination.
// Page is 700vh. Scroll progress 0→1 maps to:
//   0–0.12  : Landing
//   0.12–0.28: Warp to Work  (peaks at 0.20)
//   0.28–0.46: Work world
//   0.46–0.62: Warp to Writing (peaks at 0.54)
//   0.62–0.80: Writing world
//   0.80–0.93: Warp to Life  (peaks at 0.865)
//   0.93–1.0 : Life world

function computeWarp(pct: number): number {
  const peaks = [
    { center: 0.20, half: 0.08 },
    { center: 0.54, half: 0.08 },
    { center: 0.865, half: 0.065 },
  ];
  let warp = 0;
  for (const p of peaks) {
    const d = Math.abs(pct - p.center);
    if (d < p.half) {
      const t = 1 - d / p.half;
      warp = Math.max(warp, t * t * (3 - 2 * t)); // smoothstep
    }
  }
  return warp;
}

function getSectionIndex(pct: number): number {
  if (pct < 0.25) return 0;
  if (pct < 0.59) return 1;
  if (pct < 0.90) return 2;
  return 3;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TOP_LINKS = [
  { label: "X", href: "https://x.com/CarterKoWang" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/cartergrantwang" },
  { label: "Email", href: "mailto:cartergw01@gmail.com" },
  { label: "Substack", href: "https://carterko.substack.com/" },
];

const ESSAYS = [
  { title: "Slop & Spiral", tag: "Technology · Society", href: "https://carterko.substack.com/p/slop-and-spiral" },
  { title: "We All Have Superpowers", tag: "Technology · Human potential", href: "https://carterko.substack.com/p/we-all-have-superpowers" },
  { title: "The Mirage of Identity", tag: "Identity · Culture", href: "https://carterko.substack.com/p/the-mirage-of-identity" },
  { title: "From Crash to Curiosity", tag: "Investing · Personal", href: "https://carterko.substack.com/p/from-crash-to-curiosity" },
  { title: "Work as Play", tag: "Work · Meaning", href: "https://carterko.substack.com/p/work-as-play" },
];

const EARLIER_WORK = [
  { name: "Contrary Research", role: "Research Fellow" },
  { name: "Slug Fund", role: "VP & Head of Venture" },
  { name: "Korobra Capital", role: "Portfolio Manager" },
];

const LIFE_TILES = [
  { label: "Base", value: "Taipei" },
  { label: "Game", value: "Poker" },
  { label: "Team", value: "Lakers" },
  { label: "Sport", value: "Basketball" },
  { label: "Move", value: "Biking" },
  { label: "Winter", value: "Snowboarding" },
];

const SECTION_DOTS = ["Home", "Work", "Writing", "Life"];

// ─── Shared section heading style ────────────────────────────────────────────

function WorldHeading({ label, index, color, title }: {
  label: string; index: string; color: string; title: React.ReactNode;
}) {
  return (
    <>
      <div style={{
        fontSize: "9px", letterSpacing: "0.28em", textTransform: "uppercase",
        color, marginBottom: 18,
      }}>
        {label} · {index}
      </div>
      <h2 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(3rem, 7vw, 6rem)",
        fontWeight: 400, letterSpacing: "0.1em",
        color: "var(--foreground)", textTransform: "uppercase",
        margin: "0 0 36px", lineHeight: 0.95,
      }}>
        {title}
      </h2>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UniverseHome() {
  const warpRef = useRef(0);
  const hasScrolledRef = useRef(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const { scrollYProgress } = useScroll();

  // Drive StarField warp from custom curve (no React re-renders, ref only)
  useEffect(() => {
    return scrollYProgress.on("change", (pct) => {
      warpRef.current = computeWarp(pct);
      if (pct > 0.015 && !hasScrolledRef.current) {
        hasScrolledRef.current = true;
        setHasScrolled(true);
      }
    });
  }, [scrollYProgress]);

  useMotionValueEvent(scrollYProgress, "change", (pct) => {
    setActiveSection(getSectionIndex(pct));
  });

  // Content layer opacities — each world fades in after warp settles, out before next warp
  const landingOpacity  = useTransform(scrollYProgress, [0, 0.09, 0.14], [1, 1, 0]);
  const workOpacity     = useTransform(scrollYProgress, [0.28, 0.35, 0.43, 0.49], [0, 1, 1, 0]);
  const writingOpacity  = useTransform(scrollYProgress, [0.62, 0.69, 0.77, 0.83], [0, 1, 1, 0]);
  const lifeOpacity     = useTransform(scrollYProgress, [0.93, 0.97, 1.0], [0, 1, 1]);

  // Subtle color washes per world (very low opacity — just enough to tint the nebulae)
  const workWash    = useTransform(scrollYProgress, [0.28, 0.36, 0.43, 0.49], [0, 0.07, 0.07, 0]);
  const writingWash = useTransform(scrollYProgress, [0.62, 0.70, 0.77, 0.83], [0, 0.07, 0.07, 0]);
  const lifeWash    = useTransform(scrollYProgress, [0.93, 0.97, 1.0], [0, 0.08, 0.08]);

  return (
    <>
      {/* Scroll surface — creates the 700vh of scrollable height */}
      <div style={{ height: "700vh" }} />

      {/* Stars — warpRef drives the hyperspace effect */}
      <StarField warpRef={warpRef} />

      {/* World color atmosphere washes */}
      <motion.div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(255,100,40,1)", opacity: workWash }} />
      <motion.div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(120,80,220,1)", opacity: writingWash }} />
      <motion.div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(30,180,130,1)", opacity: lifeWash }} />

      {/* Top-right social links */}
      <div style={{ position: "fixed", top: 22, right: 26, zIndex: 20, display: "flex", gap: 22 }}>
        {TOP_LINKS.map((link, i) => (
          <motion.a
            key={link.label}
            href={link.href}
            target={link.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            whileHover={{ color: "rgba(214,228,245,1)" }}
            style={{ fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(214,228,245,0.42)", textDecoration: "none", cursor: "pointer" }}
          >
            {link.label}
          </motion.a>
        ))}
      </div>

      {/* Section indicator — right edge */}
      <div style={{
        position: "fixed", right: 20, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: 10, zIndex: 20,
      }}>
        {SECTION_DOTS.map((name, i) => (
          <div key={name} title={name} style={{
            width: activeSection === i ? 6 : 4,
            height: activeSection === i ? 6 : 4,
            borderRadius: "50%",
            background: activeSection === i ? "rgba(214,228,245,0.8)" : "rgba(214,228,245,0.2)",
            transition: "all 0.3s",
            cursor: "default",
          }} />
        ))}
      </div>

      {/* ── LANDING ───────────────────────────────────────────────────────────── */}
      <motion.div style={{
        position: "fixed", inset: 0, zIndex: 5,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        opacity: landingOpacity, pointerEvents: "none",
      }}>
        <motion.h1
          initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(5rem, 13vw, 11rem)",
            fontWeight: 400, letterSpacing: "0.16em",
            color: "var(--foreground)", textTransform: "uppercase",
            lineHeight: 0.9, textAlign: "center",
            textShadow: "0 0 120px rgba(180,210,255,0.18)",
            margin: 0,
          }}
        >
          Carter<br />Wang
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1.2 }}
          style={{
            marginTop: "1.5rem", fontSize: "0.6rem",
            letterSpacing: "0.34em", textTransform: "uppercase",
            color: "rgba(214,228,245,0.32)",
          }}
        >
          Taipei · Building · Writing
        </motion.p>

        {/* Scroll to explore hint */}
        <AnimatePresence>
          {!hasScrolled && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 2.2, duration: 1 }}
              style={{
                position: "absolute", bottom: 40,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: "9px", letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(214,228,245,0.28)" }}>
                Scroll to explore
              </span>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                style={{ color: "rgba(214,228,245,0.28)", fontSize: 13 }}
              >
                ↓
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── WORK WORLD ───────────────────────────────────────────────────────── */}
      <motion.div style={{
        position: "fixed", inset: 0, zIndex: 5,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: workOpacity, pointerEvents: "none",
      }}>
        <div style={{ maxWidth: 620, width: "100%", padding: "0 40px" }}>
          <WorldHeading label="Work" index="01" color="rgba(255,139,75,0.65)" title={<>What I&apos;m<br />Building</>} />

          {/* 886 Studios */}
          <div style={{ borderLeft: "2px solid rgba(255,139,75,0.5)", paddingLeft: 20, marginBottom: 28 }}>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--foreground)", marginBottom: 4 }}>
              886 Studios
            </div>
            <div style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,139,75,0.65)", marginBottom: 12 }}>
              Venture Associate · Taipei · Oct 2024 – Present
            </div>
            <p style={{ fontSize: "0.8125rem", lineHeight: 1.8, color: "rgba(214,228,245,0.52)", margin: 0 }}>
              Accelerator co-founded by the founders of Twitch and Guitar Hero. I own deal flow,
              helped launch ikigai Launchpad across 15+ startups, and run the founder community.
            </p>
          </div>

          {/* Earlier work chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {EARLIER_WORK.map(item => (
              <div key={item.name} style={{
                padding: "9px 14px",
                background: "rgba(255,139,75,0.06)",
                border: "1px solid rgba(255,139,75,0.14)",
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{item.name}</div>
                <div style={{ fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,139,75,0.55)", marginTop: 3 }}>{item.role}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── WRITING WORLD ─────────────────────────────────────────────────────── */}
      <motion.div style={{
        position: "fixed", inset: 0, zIndex: 5,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: writingOpacity, pointerEvents: "none",
      }}>
        <div style={{ maxWidth: 620, width: "100%", padding: "0 40px" }}>
          <WorldHeading label="Writing" index="02" color="rgba(167,139,250,0.65)" title={<>Things I<br />Think About</>} />

          <div style={{ display: "flex", flexDirection: "column" }}>
            {ESSAYS.map((essay, i) => (
              <a
                key={essay.title}
                href={essay.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "14px 0",
                  borderBottom: "1px solid rgba(167,139,250,0.1)",
                  textDecoration: "none",
                  pointerEvents: "auto",
                  cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <span style={{
                  fontSize: "10px", color: "rgba(167,139,250,0.35)",
                  fontFamily: "var(--font-display)", letterSpacing: "0.1em", minWidth: 20,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>{essay.title}</div>
                  <div style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(167,139,250,0.5)", marginTop: 3 }}>{essay.tag}</div>
                </div>
                <span style={{ color: "rgba(167,139,250,0.4)", fontSize: 13 }}>→</span>
              </a>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── LIFE WORLD ────────────────────────────────────────────────────────── */}
      <motion.div style={{
        position: "fixed", inset: 0, zIndex: 5,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: lifeOpacity, pointerEvents: "none",
      }}>
        <div style={{ maxWidth: 620, width: "100%", padding: "0 40px" }}>
          <WorldHeading label="Life" index="03" color="rgba(52,211,153,0.65)" title={<>Outside<br />Work</>} />

          <p style={{
            fontSize: "0.875rem", lineHeight: 1.85,
            color: "rgba(214,228,245,0.48)", marginBottom: 32, maxWidth: 480,
          }}>
            Grew up in Southern California. Went to UC Santa Cruz. Now in Taipei —
            which wasn&apos;t exactly the plan, but feels right.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {LIFE_TILES.map(tile => (
              <div key={tile.label} style={{
                padding: "12px 15px",
                background: "rgba(52,211,153,0.05)",
                border: "1px solid rgba(52,211,153,0.13)",
                borderRadius: 10,
              }}>
                <div style={{ fontSize: "8px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(52,211,153,0.5)", marginBottom: 5 }}>{tile.label}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)" }}>{tile.value}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}
