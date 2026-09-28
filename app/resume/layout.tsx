import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata("resume");

export default function ResumeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
