import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import ClientChrome from "@/components/ClientChrome";
import {
  buildMetadata,
  jsonLdScript,
  personJsonLd,
  siteConfig,
  websiteJsonLd,
} from "@/lib/seo";
import "./globals.css";

// One family at two widths: the headings use Archivo's expanded cut
// (font-stretch 125% wherever --font-display is set), the text its normal one.
// Self-hosted with only those widths and the weights in use (see app/fonts).
const archivoDisplay = localFont({
  src: "./fonts/archivo-latin-variable.woff2",
  weight: "400 900",
  declarations: [{ prop: "font-stretch", value: "100% 125%" }],
  variable: "--font-display",
  display: "swap",
});

const archivo = localFont({
  src: "./fonts/archivo-latin-variable.woff2",
  weight: "400 900",
  declarations: [{ prop: "font-stretch", value: "100% 125%" }],
  variable: "--font-sans",
  display: "swap",
});

// The page runs edge to edge on notched phones, so the safe-area insets the
// CSS already reads report real values; the browser bars take the space's colour.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#030611",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  ...buildMetadata("home"),
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.siteName,
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "personal portfolio",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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
      data-scroll-behavior="smooth"
      className={`dark ${archivoDisplay.variable} ${archivo.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans antialiased">
        <script {...jsonLdScript([personJsonLd(), websiteJsonLd()])} />
        <ClientChrome />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
