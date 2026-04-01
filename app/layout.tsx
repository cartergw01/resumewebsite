import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

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

const themeScript = `try { var theme = localStorage.getItem('portfolio-website-theme') || 'dark'; document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(theme); } catch (e) { document.documentElement.classList.add('dark'); }`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
