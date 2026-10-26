import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  // The islands are the homepage. /2.0 was their preview address; keep old
  // links and bookmarks working (browsers carry #work/#writing across).
  async redirects() {
    return [{ source: "/2.0", destination: "/", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*.(avif|gif|ico|jpg|jpeg|png|svg|webp|glb|mp4|webm|mov)",
        headers: [
          {
            key: "Cache-Control",
            // Stable URLs (headshots, logos, covers) can change between releases.
            // Store them, but validate with the server before reusing them.
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        // Only filenames with an explicit version or content hash are immutable.
        // Next.js manages its own hashed /_next/static assets automatically.
        source: "/:path*/:asset([^/]+-(?:v[0-9]+|[a-f0-9]{8,})).:ext(avif|gif|ico|jpg|jpeg|png|svg|webp|glb|mp4|webm|mov)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/llms.txt",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/humans.txt",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  images: {
    qualities: [75, 86, 90, 95],
    remotePatterns: [
      { protocol: "https", hostname: "substackcdn.com" },
      { protocol: "https", hostname: "substack-post-media.s3.amazonaws.com" },
    ],
  },
};

export default nextConfig;
