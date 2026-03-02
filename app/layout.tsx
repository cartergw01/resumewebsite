import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Carter Wang | Portfolio",
  description: "A personal website for Carter Wang featuring work experience, background, and writing.",
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
