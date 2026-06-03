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
  description: "Carter Wang is a venture associate at 886 Studios in Taipei, backing early-stage startups alongside the founders of Twitch and Guitar Hero. Writing essays and building projects on the side.",
  metadataBase: new URL("https://carterkowang.com"),
  openGraph: {
    title: "Carter Wang",
    description: "Venture associate at 886 Studios in Taipei, backing early-stage startups. Writing essays and building projects on the side.",
    url: "https://carterkowang.com",
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
    description: "Venture associate at 886 Studios in Taipei, backing early-stage startups. Writing essays and building projects on the side.",
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
