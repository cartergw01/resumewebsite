"use client";

import { HeroUIProvider } from "@heroui/react";
import PortfolioHome from "@/components/PortfolioHome";
import SiteNav from "@/components/SiteNav";

export default function LegacyWorkPage() {
  return (
    <HeroUIProvider>
      <SiteNav active="work" />
      <div className="legacy-work-root">
        <PortfolioHome />
      </div>
    </HeroUIProvider>
  );
}
