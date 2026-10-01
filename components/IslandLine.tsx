import type { ReactNode } from "react";
import { siteConfig } from "@/lib/seo";

function Out({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

// Each island's one-liner. The landing stop and its page header both read it
// from here, so the two never drift apart.
export default function IslandLine({ id }: { id: "work" | "writing" | "projects" }) {
  switch (id) {
    case "work":
      return <>associate at <Out href="https://886studios.com">886 Studios</Out>, working on <Out href="https://withikigai.com">ikigai Launchpad</Out> in Taipei.</>;
    case "writing":
      return <>essays on human nature, culture, and technology at <Out href={siteConfig.social.substack}><em>flying Arrows</em></Out>.</>;
    case "projects":
      return <>fun projects i made.</>;
  }
}
