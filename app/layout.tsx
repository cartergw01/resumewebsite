import type { Metadata } from "next";
import { Playfair_Display, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  description: "Carter Wang's world",
  metadataBase: new URL("https://carterkowang.com"),
  openGraph: {
    title: "Carter Wang",
    description: "Carter Wang's world",
    url: "https://carterkowang.com",
    siteName: "Carter Wang",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Carter Wang",
    description: "Carter Wang's world",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
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
        <Analytics />
      </body>
    </html>
  );
}
