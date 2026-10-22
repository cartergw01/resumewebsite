"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./MobileContact.module.css";
import { islandReturn } from "@/lib/island-location";
import { socialLinks } from "./socialLinks";

type SiteNavProps = {
  active?: "home" | "work" | "writing" | "projects" | "resume";
  hidePrimary?: boolean;
};

const primaryLinks = [
  { id: "work",     label: "Work",     href: "/work"     },
  { id: "writing",  label: "Writing",  href: "/writing"  },
  { id: "projects", label: "Projects", href: "/projects" },
] as const;

function externalLinkProps(href: string) {
  return href.startsWith("http")
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
}

export default function SiteNav({ active = "home", hidePrimary = false }: SiteNavProps) {
  const [scrolled, setScrolled] = useState(false);
  // On phones a page's bar steps out of the way as you read down it and comes
  // back as soon as you scroll up (styles in app/globals.css).
  const [tucked, setTucked] = useState(false);
  const destination = active !== "home";
  const island = active === "resume" ? "work" : active;
  const [returnHref, setReturnHref] = useState(`/#${island}`);
  // Back to where the visitor left the islands, once storage can be read.
  useEffect(() => { if (destination) setReturnHref(islandReturn(island)); }, [destination, island]);

  useEffect(() => {
    if (!destination) return;
    let previous = false;
    let lastY = window.scrollY, hidden = false;
    const sync = () => {
      const y = window.scrollY;
      const next = y > 16;
      if (next !== previous) { previous = next; setScrolled(next); }
      // A few pixels of travel either way decide; near the top it always shows.
      const delta = y - lastY;
      const hide = y < 80 ? false : delta > 8 ? true : delta < -8 ? false : hidden;
      if (Math.abs(delta) > 8 || y < 80) lastY = y;
      if (hide !== hidden) { hidden = hide; setTucked(hide); }
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [destination]);

  return (
    <>
    <header className={`site-nav${destination && active !== "resume" ? ` ${styles.destinationNav}` : ""}`} data-destination-nav={destination || undefined} data-resume-nav={active === "resume" || undefined} data-scrolled={scrolled} data-tucked={tucked || undefined}>
      {/* Every subpage returns to its island from the same upper-left spot. */}
      {destination && (
        <Link href={returnHref} scroll={false} className="site-nav-return" aria-label="Back to islands">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13 8H3m0 0 4.5-4.5M3 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="site-nav-return-label">Back to islands</span>
        </Link>
      )}
      {!hidePrimary && (
        <nav aria-label="Primary navigation" className="site-nav-primary">
          {destination && <Link href="/" className="site-nav-home">Home</Link>}
          {primaryLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={active === link.id ? "is-active" : undefined}
              aria-current={active === link.id ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      <nav aria-label="Social links" className="site-nav-social">
        {socialLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            aria-label={link.label}
            {...externalLinkProps(link.href)}
          >
            {link.icon}
          </a>
        ))}
      </nav>
    </header>
    {/* Phones: the same Work / Writing / Projects bar as the islands, in the
        same place, so the three names mean one thing everywhere. */}
    {destination && active !== "resume" && !hidePrimary && (
      <nav aria-label="Primary navigation" className={styles.dock}>
        <svg className={styles.dockArc} viewBox="0 0 480 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 46Q240 28 480 46" />
        </svg>
        {primaryLinks.map((link) => (
          <Link key={link.id} href={link.href} aria-current={active === link.id ? "page" : undefined}>
            <span className={styles.dockLabel}>{link.label}</span>
          </Link>
        ))}
      </nav>
    )}
    </>
  );
}
