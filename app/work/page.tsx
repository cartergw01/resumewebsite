"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import StarField from "@/components/StarField";
import { RocketCursor } from "@/components/RocketCursor";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

const roles = [
  {
    company: "886 Studios",
    role: "Venture Associate",
    period: "Oct 2024 – Present",
    location: "Taipei, Taiwan",
    accent: "#ff8b4b",
    rgb: "255, 139, 75",
    blurb: "886 Studios is an early-stage accelerator co-founded by the founders of Twitch and Guitar Hero, bringing Silicon Valley playbook to Asia. I joined as a Fellow and grew into an Associate role running the full deal flow machine.",
    bullets: [
      "Screen and interview 250+ early-stage startups, owning the full inbound-to-decision pipeline",
      "Core team member for ikigai Launchpad — helped select 15+ teams and supported them through workshops, office hours, investor matching, and Demo Day",
      "Spearhead Launch Station, a founder community program; run newsletters, events, and all public-facing comms",
    ],
    link: null,
  },
  {
    company: "Contrary Research",
    role: "Research Fellow",
    period: "Mar 2023 – Mar 2024",
    location: "Remote",
    accent: "#a78bfa",
    rgb: "167, 139, 250",
    blurb: "Contrary is one of the most respected early-stage VC firms in the US. As a Research Fellow I went deep on companies — reading filings, talking to users, synthesizing it into investment memos.",
    bullets: [
      "Authored deep-dive investment memos on Shield AI, SpaceX, Turo, Chime, and Hive",
      "Distilled complex technical and market dynamics into clear, compelling analysis",
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
    company: "Slug Fund",
    role: "VP & Head of Venture",
    period: "Jan 2021 – Jul 2023",
    location: "UC Santa Cruz",
    accent: "#60a5fa",
    rgb: "96, 165, 250",
    blurb: "Student investment fund at UCSC. I came in as an equity analyst, built out the venture arm from scratch, and eventually ran both sides.",
    bullets: [
      "Built the venture analyst team; led 15+ investment memos for a fantasy VC portfolio",
      "Led equity analysts running due diligence, in-depth research reports, and stock pitches",
    ],
    link: null,
  },
  {
    company: "Korobra Capital",
    role: "Portfolio Manager",
    period: "Nov 2020 – Present",
    location: "Personal fund",
    accent: "#34d399",
    rgb: "52, 211, 153",
    blurb: "Started a personal investment vehicle for family and friends. $180K+ AUM. Long-term portfolio across AI, fintech, crypto, robotics, and digital media.",
    bullets: [],
    link: null,
  },
];

export default function WorkPage() {
  return (
    <>
      <RocketCursor />
      <StarField scrollWarp={false} />

      {/* Amber atmosphere overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse at 80% 20%, rgba(255, 139, 75, 0.07) 0%, transparent 55%)",
      }} />

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0,
        zIndex: 20, padding: "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255, 139, 75, 0.08)",
        background: "rgba(6, 12, 24, 0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
        <Link href="/" style={{
          fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase",
          color: "rgba(214, 228, 245, 0.45)", textDecoration: "none",
          display: "flex", alignItems: "center", gap: 8,
          transition: "color 0.2s",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(214, 228, 245, 0.9)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(214, 228, 245, 0.45)")}
        >
          ← Carter Wang
        </Link>

        <div style={{ display: "flex", gap: 24 }}>
          {[{ label: "Writing", href: "/writing", rgb: "167, 139, 250" }, { label: "Life", href: "/life", rgb: "52, 211, 153" }].map(l => (
            <Link key={l.label} href={l.href} style={{
              fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase",
              color: `rgba(${l.rgb}, 0.45)`, textDecoration: "none", transition: "color 0.2s",
              display: "flex", alignItems: "center", gap: 6,
            }}
              onMouseEnter={e => (e.currentTarget.style.color = `rgba(${l.rgb}, 1)`)}
              onMouseLeave={e => (e.currentTarget.style.color = `rgba(${l.rgb}, 0.45)`)}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: `rgba(${l.rgb}, 0.6)`, display: "inline-block" }} />
              {l.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main style={{
        position: "relative", zIndex: 5,
        maxWidth: 680, margin: "0 auto",
        padding: "120px 32px 80px",
      }}>
        {/* Page heading */}
        <motion.div {...fade(0)} style={{ marginBottom: 64 }}>
          <div style={{
            fontSize: "10px", letterSpacing: "0.24em", textTransform: "uppercase",
            color: "rgba(255, 139, 75, 0.6)", marginBottom: 14,
          }}>
            Work
          </div>
          <h1 style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700, letterSpacing: "0.04em",
            color: "var(--foreground)", lineHeight: 1.1,
            margin: 0,
          }}>
            What I&apos;m building
          </h1>
        </motion.div>

        {/* Roles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
          {roles.map((role, i) => (
            <motion.div key={role.company} {...fade(0.1 + i * 0.08)}>
              {/* Role header */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                {/* Accent dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: role.accent,
                  boxShadow: `0 0 12px rgba(${role.rgb}, 0.7)`,
                  flexShrink: 0, marginTop: 6,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <h2 style={{
                      fontSize: "1.1rem", fontWeight: 600,
                      color: "var(--foreground)", margin: 0,
                    }}>
                      {role.company}
                    </h2>
                    <span style={{
                      fontSize: "10px", letterSpacing: "0.12em",
                      color: "rgba(214, 228, 245, 0.35)",
                    }}>
                      {role.period}
                    </span>
                  </div>
                  <div style={{
                    fontSize: "11px", letterSpacing: "0.1em",
                    color: `rgba(${role.rgb}, 0.7)`,
                    textTransform: "uppercase", marginTop: 3,
                  }}>
                    {role.role} · {role.location}
                  </div>
                </div>
              </div>

              {/* Blurb */}
              <p style={{
                fontSize: "0.875rem", lineHeight: 1.75,
                color: "rgba(214, 228, 245, 0.6)",
                margin: "0 0 14px 24px",
              }}>
                {role.blurb}
              </p>

              {/* Bullets */}
              {role.bullets.length > 0 && (
                <ul style={{ margin: "0 0 0 24px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  {role.bullets.map(b => (
                    <li key={b} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      fontSize: "0.8125rem", lineHeight: 1.65,
                      color: "rgba(214, 228, 245, 0.5)",
                    }}>
                      <span style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: `rgba(${role.rgb}, 0.4)`,
                        flexShrink: 0, marginTop: "0.5rem",
                      }} />
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              {/* Research links */}
              {"links" in role && role.links && (
                <div style={{ marginLeft: 24, marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {role.links.map(l => (
                    <a key={l.href} href={l.href} target="_blank" rel="noreferrer" style={{
                      fontSize: "11px", letterSpacing: "0.08em",
                      color: `rgba(${role.rgb}, 0.7)`,
                      textDecoration: "underline", textDecorationColor: `rgba(${role.rgb}, 0.3)`,
                      textUnderlineOffset: "3px",
                    }}>
                      {l.label}
                    </a>
                  ))}
                </div>
              )}

              {/* Divider */}
              {i < roles.length - 1 && (
                <div style={{
                  marginTop: 56, height: 1,
                  background: "linear-gradient(to right, rgba(255,139,75,0.12), transparent)",
                }} />
              )}
            </motion.div>
          ))}
        </div>
      </main>
    </>
  );
}
