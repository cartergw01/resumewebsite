import type { Metadata } from "next";
import IslandHome from "@/components/IslandHome";
import { buildMetadata } from "@/lib/seo";

const homeMetadata = buildMetadata("home");

export const metadata: Metadata = {
  ...homeMetadata,
  alternates: { canonical: "/2.0" },
  openGraph: { ...homeMetadata.openGraph, url: "/2.0" },
  robots: { index: false, follow: true },
};

export default function IslandHomePage() {
  return <IslandHome />;
}
