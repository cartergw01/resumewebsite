import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  images: {
    qualities: [75, 86, 90, 95],
  },
};

export default nextConfig;
