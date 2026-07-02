import type { MetadataRoute } from "next";
import { absoluteUrl, routes } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: absoluteUrl(routes.home.path),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: absoluteUrl(routes.work.path),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: absoluteUrl(routes.writing.path),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl(routes.projects.path),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
