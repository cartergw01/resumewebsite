import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Work — Carter Wang",
  description:
    "Associate at 886 Studios in Taipei, working on ikigai Launchpad alongside the founders of Twitch and Guitar Hero.",
};

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
