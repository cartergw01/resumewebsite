"use client";

import { HeroUIProvider } from "@heroui/react";
import PortfolioHome from "@/components/PortfolioHome";
import SiteNav from "@/components/SiteNav";

export default function WorkPageClient() {
  return (
    <HeroUIProvider>
      <SiteNav active="work" />
      <div className="legacy-work-root" data-rocket-launch-zone>
        <PortfolioHome />
      </div>
    </HeroUIProvider>
  );
}
