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

const essays = [
  {
    title: "Slop & Spiral",
    subtitle: "We numb our minds and eventually our souls, and yet we are stimulated. For we have found not the fountain of living water, but the abyss of infinite cheap dopamine.",
    href: "https://carterko.substack.com/p/slop-and-spiral",
    tag: "Technology · Society",
  },
  {
    title: "We All Have Superpowers",
    subtitle: "We invent technology to extend ourselves. Every tool we build is a kind of prosthetic for the mind.",
    href: "https://carterko.substack.com/p/we-all-have-superpowers",
    tag: "Technology · Human potential",
  },
  {
    title: "The Mirage of Identity",
    subtitle: "Our social world in the 21st century and the self we perform inside it.",
    href: "https://carterko.substack.com/p/the-mirage-of-identity",
    tag: "Identity · Culture",
  },
  {
    title: "From Crash to Curiosity",
    subtitle: "How losing money in the markets turned into a decade-long obsession with how the world works.",
    href: "https://carterko.substack.com/p/from-crash-to-curiosity",
    tag: "Investing · Personal",
  },
  {
    title: "Work as Play",
    subtitle: "A reflection on the cusp of a career — on making work feel like something you chose, not something that happened to you.",
    href: "https://carterko.substack.com/p/work-as-play",
    tag: "Work · Meaning",
  },
];

export default function WritingPage() {
  return (
    <>
      <RocketCursor />
      <StarField scrollWarp={false} />

      {/* Violet atmosphere overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse at 20% 30%, rgba(167, 139, 250, 0.08) 0%, transparent 55%)",
      }} />

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0,
        zIndex: 20, padding: "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(167, 139, 250, 0.08)",
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
          {[{ label: "Work", href: "/work", rgb: "255, 139, 75" }, { label: "Life", href: "/life", rgb: "52, 211, 153" }].map(l => (
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
            color: "rgba(167, 139, 250, 0.6)", marginBottom: 14,
          }}>
            Writing
          </div>
          <h1 style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700, letterSpacing: "0.04em",
            color: "var(--foreground)", lineHeight: 1.1,
            margin: 0,
          }}>
            Things I think about
          </h1>
        </motion.div>

        <motion.p {...fade(0.1)} style={{
          fontSize: "0.875rem", lineHeight: 1.8,
          color: "rgba(214, 228, 245, 0.5)",
          marginBottom: 64, maxWidth: 520,
        }}>
          I write on Substack about technology, identity, and what it means to live and work well.
          Mostly long-form. Sometimes personal. Always something I actually believe.
        </motion.p>

        {/* Essays */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {essays.map((essay, i) => (
            <motion.a
              key={essay.title}
              href={essay.href}
              target="_blank"
              rel="noreferrer"
              {...fade(0.15 + i * 0.07)}
              style={{
                display: "block",
                padding: "28px 0",
                borderTop: "1px solid rgba(167, 139, 250, 0.08)",
                textDecoration: "none",
                cursor: "pointer",
                borderLeft: "2px solid transparent",
                paddingLeft: 20,
                marginLeft: -20,
                transition: "border-color 0.2s",
              }}
              whileHover={{
                borderLeftColor: "rgba(167, 139, 250, 0.5)",
                x: 4,
                transition: { duration: 0.18 },
              }}
            >
              <div style={{
                fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase",
                color: "rgba(167, 139, 250, 0.5)", marginBottom: 8,
              }}>
                {essay.tag}
              </div>
              <h2 style={{
                fontSize: "1.1rem", fontWeight: 600,
                color: "var(--foreground)", margin: "0 0 8px",
                lineHeight: 1.3,
              }}>
                {essay.title}
              </h2>
              <p style={{
                fontSize: "0.8125rem", lineHeight: 1.7,
                color: "rgba(214, 228, 245, 0.45)",
                margin: 0, maxWidth: 500,
              }}>
                {essay.subtitle}
              </p>
              <div style={{
                marginTop: 12,
                fontSize: "9px", letterSpacing: "0.16em",
                color: "rgba(167, 139, 250, 0.45)", textTransform: "uppercase",
              }}>
                Read on Substack →
              </div>
            </motion.a>
          ))}

          {/* Last divider */}
          <div style={{ borderTop: "1px solid rgba(167, 139, 250, 0.08)" }} />
        </div>

        {/* Substack CTA */}
        <motion.div {...fade(0.6)} style={{ marginTop: 48 }}>
          <a
            href="https://carterko.substack.com/"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "12px 24px",
              background: "rgba(167, 139, 250, 0.08)",
              border: "1px solid rgba(167, 139, 250, 0.2)",
              borderRadius: 12,
              fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase",
              color: "rgba(167, 139, 250, 0.8)",
              textDecoration: "none",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(167, 139, 250, 0.14)";
              e.currentTarget.style.borderColor = "rgba(167, 139, 250, 0.35)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(167, 139, 250, 0.08)";
              e.currentTarget.style.borderColor = "rgba(167, 139, 250, 0.2)";
            }}
          >
            Subscribe on Substack
            <span style={{ fontSize: 13 }}>→</span>
          </a>
        </motion.div>
      </main>
    </>
  );
}
