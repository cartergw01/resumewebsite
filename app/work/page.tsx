import dynamic from "next/dynamic";

// HeroUI + Framer Motion are heavy (~180 KB gzipped). Dynamic import keeps
// them out of the shared bundle so every other page loads faster.
const LegacyWorkPage = dynamic(() => import("@/components/LegacyWorkPage"), {
  ssr: false,
});

export default function WorkPage() {
  return <LegacyWorkPage />;
}
