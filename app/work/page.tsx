import type { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "Work — Carter Wang",
  description:
    "Associate at 886 Studios in Taipei, working on ikigai Launchpad alongside the founders of Twitch and Guitar Hero.",
};

// HeroUI + Framer Motion are heavy (~180 KB gzipped). Dynamic import keeps
// them out of the shared bundle so every other page loads faster.
const LegacyWorkPage = dynamic(() => import("@/components/LegacyWorkPage"), {
  ssr: false,
});

export default function WorkPage() {
  return <LegacyWorkPage />;
}
