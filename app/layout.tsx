import type { Metadata } from "next";
import { Playfair_Display, Space_Grotesk } from "next/font/google";
import { RocketCursor } from "@/components/RocketCursor";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Carter Wang",
  description: "A personal website for Carter Wang featuring work experience, background, and writing.",
  metadataBase: new URL("https://portfolio-website-cartergw01s-projects.vercel.app"),
  openGraph: {
    title: "Carter Wang",
    description: "Venture work, writing, and background from Carter Wang.",
    url: "https://portfolio-website-cartergw01s-projects.vercel.app",
    siteName: "Carter Wang",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Carter Wang portfolio preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Carter Wang",
    description: "Venture work, writing, and background from Carter Wang.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/icon",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`dark ${playfair.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-screen font-sans antialiased">
        <RocketCursor />
        {children}
      </body>
    </html>
  );
}
