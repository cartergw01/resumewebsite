import type { Metadata } from "next";
import UniverseWorld from "@/components/UniverseWorld";
import { breadcrumbJsonLd, buildMetadata, jsonLdScript, webPageJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata("home");

export default function Page() {
  return (
    <>
      <script
        {...jsonLdScript([
          webPageJsonLd("home"),
          breadcrumbJsonLd([{ name: "Home", path: "/" }]),
        ])}
      />
      {/* Preload the hero background — CSS backgrounds are discovered late, so
          this hint moves the fetch earlier. fetchPriority high marks it as the
          LCP resource so the browser fetches it ahead of lower-priority assets. */}
      <link
        rel="preload"
        as="image"
        href="/cosmic-hero-desktop.webp"
        imageSrcSet="/cosmic-hero-desktop.webp 1x, /cosmic-hero-desktop-2x.webp 2x"
        type="image/webp"
        media="(min-width: 761px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/cosmic-hero-mobile.webp"
        imageSrcSet="/cosmic-hero-mobile.webp 1x, /cosmic-hero-mobile-2x.webp 2x"
        type="image/webp"
        media="(max-width: 760px)"
        fetchPriority="high"
      />
      <UniverseWorld />
    </>
  );
}
