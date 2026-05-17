"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import StarField from "./StarField";

const NAV_LINKS = ["Work", "Writing", "Projects", "Life", "About"];

const SECTIONS = [
  {
    id: "work",
    num: "01",
    label: "Work",
    color: "amber",
    heading: "Venture & Acceleration",
    description:
      "I help founders build companies at the intersection of technology and culture. Currently accelerating startups bridging East and West.",
    cta: "Explore Work",
    href: "/work",
    tags: ["Venture", "Acceleration", "Bridge Building"],
    accent: "rgba(255, 139, 75, 0.18)",
    accentStrong: "rgba(255, 139, 75, 0.32)",
    accentText: "#ff8b4b",
    bg: "radial-gradient(ellipse at 70% 50%, rgba(255,139,75,0.12) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(200,80,20,0.10) 0%, transparent 50%)",
    card: {
      label: "Recent Work",
      items: [
        { title: "886 Accelerator", sub: "Program Director", detail: "Taiwan ↔ Global" },
        { title: "Ikigai Ventures", sub: "Venture Fellow", detail: "Early Stage" },
        { title: "Bridge Projects", sub: "Cross-Cultural Tech", detail: "Ongoing" },
      ],
    },
  },
  {
    id: "writing",
    num: "02",
    label: "Writing",
    color: "violet",
    heading: "Ideas Worth Sharing",
    description:
      "Essays and notes on technology, culture, and building things that matter. Writing is how I think out loud.",
    cta: "Read Writing",
    href: "/writing",
    tags: ["Essays", "Notes", "Thoughts"],
    accent: "rgba(140, 80, 255, 0.18)",
    accentStrong: "rgba(140, 80, 255, 0.32)",
    accentText: "#a87fff",
    bg: "radial-gradient(ellipse at 65% 40%, rgba(120,60,255,0.14) 0%, transparent 60%), radial-gradient(ellipse at 25% 70%, rgba(60,20,180,0.10) 0%, transparent 50%)",
    card: {
      label: "On Writing",
      quote:
        '"The best essays are not about conclusions — they are about the journey of arriving at them."',
    },
  },
  {
    id: "projects",
    num: "03",
    label: "Projects",
    color: "blue",
    heading: "Things I've Built",
    description:
      "Side projects, experiments, and tools I've shipped along the way. Building is the best way to learn.",
    cta: "See Projects",
    href: "/life",
    tags: ["Apps", "Tools", "Experiments"],
    accent: "rgba(55, 119, 255, 0.18)",
    accentStrong: "rgba(55, 119, 255, 0.32)",
    accentText: "#5e8cff",
    bg: "radial-gradient(ellipse at 60% 45%, rgba(40,90,255,0.14) 0%, transparent 60%), radial-gradient(ellipse at 30% 75%, rgba(10,40,160,0.10) 0%, transparent 50%)",
    projects: [
      { name: "Taipei Flix", desc: "Movie night for Taipei expats" },
      { name: "Ikigai Calendar", desc: "Purpose-driven scheduling" },
      { name: "Poker Odds", desc: "Real-time equity calculator" },
      { name: "Job Hunter", desc: "AI-powered job search tool" },
    ],
  },
  {
    id: "life",
    num: "04",
    label: "Life",
    color: "amber",
    heading: "The Human Behind the Work",
    description:
      "Taiwanese-American, based in Taipei. I run, eat well, and spend too much time thinking about cities, culture, and what makes life worth living.",
    cta: "More About Life",
    href: "/life",
    tags: ["Taipei", "Running", "Food", "Culture"],
    accent: "rgba(255, 180, 75, 0.18)",
    accentStrong: "rgba(255, 180, 75, 0.32)",
    accentText: "#ffb84b",
    bg: "radial-gradient(ellipse at 55% 35%, rgba(255,160,60,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 75%, rgba(180,80,20,0.08) 0%, transparent 50%)",
    snapshots: ["Running", "Taipei", "Food", "Culture", "Friends"],
  },
];

function Nav() {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2.5rem",
        height: "4rem",
        background: "rgba(6, 12, 24, 0.72)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(180, 210, 255, 0.08)",
      }}
    >
      <a
        href="/"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.35rem",
          fontWeight: 700,
          color: "#ecf4ff",
          letterSpacing: "0.04em",
          textDecoration: "none",
        }}
      >
        CW
      </a>

      <div style={{ display: "flex", gap: "2.5rem", alignItems: "center" }}>
        {NAV_LINKS.map((link) => (
          <a
            key={link}
            href={`/${link.toLowerCase()}`}
            style={{
              fontSize: "0.85rem",
              letterSpacing: "0.06em",
              color: "rgba(214, 228, 245, 0.72)",
              textDecoration: "none",
              transition: "color 0.2s",
              fontFamily: "var(--font-sans)",
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#ecf4ff")}
            onMouseLeave={(e) =>
              ((e.target as HTMLElement).style.color = "rgba(214, 228, 245, 0.72)")
            }
          >
            {link}
          </a>
        ))}
      </div>

      <a
        href="mailto:cartergw01@gmail.com"
        style={{
          fontSize: "0.82rem",
          letterSpacing: "0.05em",
          color: "#ecf4ff",
          textDecoration: "none",
          padding: "0.45rem 1.2rem",
          border: "1px solid rgba(180, 210, 255, 0.24)",
          borderRadius: "9999px",
          background: "rgba(255,255,255,0.05)",
          transition: "border-color 0.2s, background 0.2s",
          fontFamily: "var(--font-sans)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,139,75,0.5)";
          (e.currentTarget as HTMLElement).style.background = "rgba(255,139,75,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(180, 210, 255, 0.24)";
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
        }}
      >
        Get in touch
      </a>
    </nav>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <StarField scrollWarp={false} />

      {/* Atmospheric center glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(55,119,255,0.10) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        style={{ opacity, y, position: "relative", zIndex: 10, textAlign: "center" }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.78rem",
            letterSpacing: "0.28em",
            color: "rgba(214, 228, 245, 0.55)",
            marginBottom: "1.5rem",
            textTransform: "uppercase",
          }}
        >
          Welcome to my corner of the internet
        </p>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(4rem, 10vw, 8rem)",
            fontWeight: 700,
            color: "#ecf4ff",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            marginBottom: "1.5rem",
          }}
        >
          Carter Wang
        </h1>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(1rem, 2vw, 1.2rem)",
            color: "rgba(214, 228, 245, 0.65)",
            maxWidth: "520px",
            lineHeight: 1.7,
            marginBottom: "3rem",
          }}
        >
          Exploring technology and culture at the frontier of East and West.
          <br />
          Builder, writer, bridge-maker.
        </p>

        <a
          href="#work"
          style={{
            display: "inline-block",
            fontFamily: "var(--font-sans)",
            fontSize: "0.9rem",
            letterSpacing: "0.08em",
            color: "#ecf4ff",
            padding: "0.8rem 2.4rem",
            border: "1px solid rgba(255, 139, 75, 0.4)",
            borderRadius: "9999px",
            background: "rgba(255,139,75,0.08)",
            textDecoration: "none",
            transition: "all 0.25s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,139,75,0.16)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,139,75,0.65)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,139,75,0.08)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,139,75,0.4)";
          }}
        >
          Explore my worlds ↓
        </a>

        <p
          style={{
            marginTop: "1.2rem",
            fontFamily: "var(--font-sans)",
            fontSize: "0.72rem",
            letterSpacing: "0.2em",
            color: "rgba(180, 210, 255, 0.35)",
            textTransform: "uppercase",
          }}
        >
          Scroll to hyperspace
        </p>
      </motion.div>

      {/* Section dots — right side */}
      <div
        style={{
          position: "absolute",
          right: "2rem",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          zIndex: 20,
        }}
      >
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            title={s.label}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "9999px",
              background: "rgba(180,210,255,0.3)",
              display: "block",
              transition: "background 0.2s, transform 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#ff8b4b";
              (e.currentTarget as HTMLElement).style.transform = "scale(1.6)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(180,210,255,0.3)";
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          />
        ))}
      </div>
    </section>
  );
}

function WorkCard({ card }: { card: (typeof SECTIONS)[0]["card"] }) {
  if (!card || !("items" in card)) return null;
  return (
    <div
      style={{
        background: "rgba(12,26,48,0.72)",
        border: "1px solid rgba(255,139,75,0.18)",
        borderRadius: "1rem",
        padding: "1.5rem",
        backdropFilter: "blur(20px)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.7rem",
          letterSpacing: "0.18em",
          color: "#ff8b4b",
          textTransform: "uppercase",
          marginBottom: "1rem",
        }}
      >
        {card.label}
      </p>
      {card.items?.map((item) => (
        <div
          key={item.title}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "0.75rem 0",
            borderBottom: "1px solid rgba(180,210,255,0.07)",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "0.9rem",
                color: "#ecf4ff",
                fontWeight: 500,
              }}
            >
              {item.title}
            </p>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "0.78rem",
                color: "rgba(214,228,245,0.55)",
              }}
            >
              {item.sub}
            </p>
          </div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.72rem",
              color: "#ff8b4b",
              background: "rgba(255,139,75,0.1)",
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
              whiteSpace: "nowrap",
            }}
          >
            {item.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

function WritingCard({ card }: { card: (typeof SECTIONS)[1]["card"] }) {
  if (!card || !("quote" in card)) return null;
  return (
    <div
      style={{
        background: "rgba(12,26,48,0.72)",
        border: "1px solid rgba(140,80,255,0.18)",
        borderRadius: "1rem",
        padding: "2rem",
        backdropFilter: "blur(20px)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.1rem",
          color: "rgba(214,228,245,0.82)",
          lineHeight: 1.65,
          fontStyle: "italic",
          marginBottom: "1rem",
        }}
      >
        {card.quote}
      </p>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.75rem",
          color: "rgba(180,210,255,0.45)",
          letterSpacing: "0.1em",
        }}
      >
        — Carter Wang
      </p>
    </div>
  );
}

function AtmosphericVisual({
  section,
}: {
  section: (typeof SECTIONS)[number];
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "320px",
        borderRadius: "1.5rem",
        overflow: "hidden",
        border: `1px solid ${section.accentStrong}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: section.bg,
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "6rem",
            color: section.accentStrong,
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          {section.num}
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.75rem",
            letterSpacing: "0.2em",
            color: section.accentText,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          {section.label}
        </span>
      </div>
    </div>
  );
}

function WorldSection({ section, index }: { section: (typeof SECTIONS)[number]; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
  const yText = useTransform(scrollYProgress, [0, 0.15], [40, 0]);

  const isEven = index % 2 === 0;

  return (
    <section
      id={section.id}
      ref={ref}
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        padding: "8rem 0",
      }}
    >
      {/* Section atmospheric background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: section.bg,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(6,12,24,0.6) 0%, transparent 20%, transparent 80%, rgba(6,12,24,0.6) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 2.5rem",
          display: "grid",
          gridTemplateColumns: isEven ? "1fr 1fr 1fr" : "1fr 1fr 1fr",
          gap: "3rem",
          alignItems: "center",
        }}
      >
        {/* Left: text column */}
        <motion.div style={{ opacity, y: yText }}>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.72rem",
              letterSpacing: "0.22em",
              color: section.accentText,
              textTransform: "uppercase",
              marginBottom: "0.75rem",
            }}
          >
            {section.num} / {section.label}
          </p>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 4vw, 3.2rem)",
              fontWeight: 700,
              color: "#ecf4ff",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: "1.25rem",
            }}
          >
            {section.heading}
          </h2>

          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.95rem",
              color: "rgba(214,228,245,0.68)",
              lineHeight: 1.75,
              marginBottom: "2rem",
            }}
          >
            {section.description}
          </p>

          <a
            href={section.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontFamily: "var(--font-sans)",
              fontSize: "0.88rem",
              letterSpacing: "0.06em",
              color: section.accentText,
              textDecoration: "none",
              borderBottom: `1px solid ${section.accentStrong}`,
              paddingBottom: "0.15rem",
              transition: "opacity 0.2s",
            }}
          >
            {section.cta} →
          </a>

          <div style={{ marginTop: "2rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {section.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.72rem",
                  letterSpacing: "0.08em",
                  color: section.accentText,
                  background: section.accent,
                  border: `1px solid ${section.accentStrong}`,
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Center: atmospheric visual */}
        <motion.div style={{ opacity }}>
          <AtmosphericVisual section={section} />
        </motion.div>

        {/* Right: card */}
        <motion.div style={{ opacity, y: useTransform(scrollYProgress, [0, 0.2], [30, 0]) }}>
          {section.id === "work" && <WorkCard card={section.card!} />}
          {section.id === "writing" && <WritingCard card={section.card!} />}
          {section.id === "projects" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              {section.projects?.map((p) => (
                <div
                  key={p.name}
                  style={{
                    background: "rgba(12,26,48,0.72)",
                    border: `1px solid ${section.accentStrong}`,
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    backdropFilter: "blur(20px)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.88rem",
                      color: "#ecf4ff",
                      fontWeight: 500,
                      marginBottom: "0.25rem",
                    }}
                  >
                    {p.name}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.75rem",
                      color: "rgba(214,228,245,0.5)",
                    }}
                  >
                    {p.desc}
                  </p>
                </div>
              ))}
            </div>
          )}
          {section.id === "life" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {section.snapshots?.map((snap, i) => (
                <div
                  key={snap}
                  style={{
                    background: "rgba(12,26,48,0.72)",
                    border: `1px solid ${section.accentStrong}`,
                    borderRadius: "0.75rem",
                    padding: "0.85rem 1.1rem",
                    backdropFilter: "blur(20px)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>
                    {["🏃", "🏙️", "🍜", "🌏", "👥"][i]}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.88rem",
                      color: "rgba(214,228,245,0.75)",
                    }}
                  >
                    {snap}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      style={{
        position: "relative",
        borderTop: "1px solid rgba(180,210,255,0.08)",
        padding: "3rem 2.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        background: "rgba(6,12,24,0.6)",
        backdropFilter: "blur(20px)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#ecf4ff",
          letterSpacing: "0.04em",
        }}
      >
        CW
      </span>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.82rem",
          color: "rgba(180,210,255,0.4)",
          letterSpacing: "0.08em",
        }}
      >
        Exploring at the intersection of technology & culture
      </p>
      <div style={{ display: "flex", gap: "1.5rem" }}>
        {[
          { label: "Twitter", href: "https://twitter.com/carterwang" },
          { label: "LinkedIn", href: "https://linkedin.com/in/carterwang" },
          { label: "Email", href: "mailto:cartergw01@gmail.com" },
        ].map((s) => (
          <a
            key={s.label}
            href={s.href}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.8rem",
              color: "rgba(180,210,255,0.45)",
              textDecoration: "none",
              letterSpacing: "0.06em",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#ecf4ff")}
            onMouseLeave={(e) =>
              ((e.target as HTMLElement).style.color = "rgba(180,210,255,0.45)")
            }
          >
            {s.label}
          </a>
        ))}
      </div>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.72rem",
          color: "rgba(180,210,255,0.25)",
        }}
      >
        © 2025 Carter Wang
      </p>
    </footer>
  );
}

export default function UniverseWorld() {
  return (
    <div style={{ position: "relative", background: "var(--background)" }}>
      <Nav />

      {/* Global starfield — always behind everything */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <StarField scrollWarp />
      </div>

      <main style={{ position: "relative", zIndex: 1 }}>
        <Hero />
        {SECTIONS.map((s, i) => (
          <WorldSection key={s.id} section={s} index={i} />
        ))}
      </main>

      <Footer />
    </div>
  );
}
