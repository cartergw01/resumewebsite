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

const tiles = [
  {
    label: "Where",
    value: "Taipei, Taiwan",
    sub: "Originally from Irvine, California",
    accent: "#34d399",
    rgb: "52, 211, 153",
    span: 2,
  },
  {
    label: "Game",
    value: "Poker",
    sub: "Texas Hold'em. Cash games mostly.",
    accent: "#34d399",
    rgb: "52, 211, 153",
    span: 1,
  },
  {
    label: "Team",
    value: "Lakers",
    sub: "Through thick and thin.",
    accent: "#fbbf24",
    rgb: "251, 191, 36",
    span: 1,
  },
  {
    label: "Sport",
    value: "Basketball",
    sub: "Playing, not just watching.",
    accent: "#34d399",
    rgb: "52, 211, 153",
    span: 1,
  },
  {
    label: "Move",
    value: "Biking",
    sub: "How I see Taipei.",
    accent: "#34d399",
    rgb: "52, 211, 153",
    span: 1,
  },
  {
    label: "Winter",
    value: "Snowboarding",
    sub: "When I can find a mountain.",
    accent: "#60a5fa",
    rgb: "96, 165, 250",
    span: 1,
  },
  {
    label: "Reading",
    value: "Always",
    sub: "Biographies, essays, anything about technology and how we live.",
    accent: "#34d399",
    rgb: "52, 211, 153",
    span: 1,
  },
];

export default function LifePage() {
  return (
    <>
      <RocketCursor />
      <StarField scrollWarp={false} />

      {/* Teal atmosphere overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse at 70% 70%, rgba(52, 211, 153, 0.06) 0%, transparent 55%)",
      }} />

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0,
        zIndex: 20, padding: "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(52, 211, 153, 0.08)",
        background: "rgba(6, 12, 24, 0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
        <Link href="/" style={{
          fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase",
          color: "rgba(214, 228, 245, 0.45)", textDecoration: "none",
          display: "flex", alignItems: "center", gap: 8, transition: "color 0.2s",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(214, 228, 245, 0.9)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(214, 228, 245, 0.45)")}
        >
          ← Carter Wang
        </Link>

        <div style={{ display: "flex", gap: 24 }}>
          {[{ label: "Work", href: "/work", rgb: "255, 139, 75" }, { label: "Writing", href: "/writing", rgb: "167, 139, 250" }].map(l => (
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
        {/* Heading */}
        <motion.div {...fade(0)} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: "10px", letterSpacing: "0.24em", textTransform: "uppercase",
            color: "rgba(52, 211, 153, 0.6)", marginBottom: 14,
          }}>
            Life
          </div>
          <h1 style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700, letterSpacing: "0.04em",
            color: "var(--foreground)", lineHeight: 1.1,
            margin: 0,
          }}>
            Outside work
          </h1>
        </motion.div>

        <motion.p {...fade(0.1)} style={{
          fontSize: "0.875rem", lineHeight: 1.8,
          color: "rgba(214, 228, 245, 0.5)",
          marginBottom: 56, maxWidth: 520,
        }}>
          I grew up in Southern California, went to UC Santa Cruz, and ended up in Taipei — which
          wasn&apos;t exactly the plan, but feels right. When I&apos;m not working I&apos;m biking
          around the city, playing poker, watching the Lakers, or reading something that&apos;s probably
          going to end up in an essay.
        </motion.p>

        {/* Tile grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}>
          {tiles.map((tile, i) => (
            <motion.div
              key={tile.label}
              {...fade(0.15 + i * 0.06)}
              style={{
                gridColumn: tile.span === 2 ? "span 2" : "span 1",
                padding: "22px 24px",
                background: "rgba(6, 12, 28, 0.7)",
                border: `1px solid rgba(${tile.rgb}, 0.12)`,
                borderRadius: 16,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              <div style={{
                fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase",
                color: `rgba(${tile.rgb}, 0.5)`, marginBottom: 8,
              }}>
                {tile.label}
              </div>
              <div style={{
                fontSize: "1.1rem", fontWeight: 600,
                color: "var(--foreground)", marginBottom: 4,
              }}>
                {tile.value}
              </div>
              <div style={{
                fontSize: "0.8rem", lineHeight: 1.6,
                color: "rgba(214, 228, 245, 0.4)",
              }}>
                {tile.sub}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Taipei note */}
        <motion.div {...fade(0.6)} style={{
          marginTop: 48,
          padding: "24px 28px",
          background: "rgba(52, 211, 153, 0.05)",
          border: "1px solid rgba(52, 211, 153, 0.12)",
          borderRadius: 16,
          borderLeft: "3px solid rgba(52, 211, 153, 0.4)",
        }}>
          <div style={{
            fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase",
            color: "rgba(52, 211, 153, 0.5)", marginBottom: 10,
          }}>
            Currently in
          </div>
          <p style={{
            fontSize: "0.875rem", lineHeight: 1.75,
            color: "rgba(214, 228, 245, 0.55)",
            margin: 0,
          }}>
            Taipei is one of those cities that rewards you for showing up without expectations.
            Great food, dense energy, surprisingly easy to live in. I bike everywhere.
            The night markets are a feature, not a bug.
          </p>
        </motion.div>
      </main>
    </>
  );
}
