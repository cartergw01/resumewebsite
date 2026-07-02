import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata("work");

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
