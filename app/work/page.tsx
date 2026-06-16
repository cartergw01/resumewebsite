"use client";

import dynamic from "next/dynamic";

// HeroUI and the Work page effects are heavy, so keep the whole shell loaded
// only on this route.
const WorkPageClient = dynamic(() => import("@/components/WorkPageClient"), {
  ssr: false,
});

export default function WorkPage() {
  return <WorkPageClient />;
}
