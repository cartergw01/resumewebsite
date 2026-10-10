import type { Metadata } from "next";
import IslandHome from "@/components/IslandHome";
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
      <IslandHome />
    </>
  );
}
