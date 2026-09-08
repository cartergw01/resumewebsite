import type { Metadata } from "next";
import RooftopHome from "@/components/RooftopHome";
import { buildMetadata } from "@/lib/seo";

const homeMetadata = buildMetadata("home");

export const metadata: Metadata = {
  ...homeMetadata,
  alternates: { canonical: "/new" },
  openGraph: { ...homeMetadata.openGraph, url: "/new" },
  robots: { index: false, follow: true },
};

export default function NewHomePage() {
  return <RooftopHome />;
}
