import type { Metadata } from "next";
import { essays, projects, workPageBio, workPageSkills } from "@/content/portfolio";

export const siteConfig = {
  name: "Carter Wang",
  siteName: "Carter Wang",
  url: "https://carterkowang.com",
  locale: "en_US",
  language: "en",
  email: "cartergw01@gmail.com",
  description:
    "Personal site of Carter Wang, a venture associate at 886 Studios in Taipei, featuring work in startups and investing, essays, and side projects.",
  shortDescription:
    "Carter Wang's personal site for venture work, writing, and side projects.",
  social: {
    x: "https://x.com/CarterKoWang",
    linkedin: "https://www.linkedin.com/in/cartergrantwang",
    substack: "https://carterko.substack.com/",
  },
  ogImage: {
    url: "/og-preview.png",
    width: 1200,
    height: 630,
    alt: "Carter Wang personal website preview",
  },
} as const;

export const routes = {
  home: {
    path: "/",
    title: "Carter Wang | Venture, Writing, and Projects",
    description: siteConfig.description,
    keywords: [
      "Carter Wang",
      "Carter Ko Wang",
      "venture associate",
      "886 Studios",
      "ikigai Launchpad",
      "Taipei startups",
      "startup investing",
      "technology essays",
      "personal portfolio",
    ],
  },
  work: {
    path: "/work",
    title: "Work | Carter Wang",
    description:
      "Carter Wang's work in venture, startup acceleration, investment research, founder programs, and community building at 886 Studios, Contrary Research, Slug Fund, and Korobra Capital.",
    keywords: [
      "Carter Wang work",
      "886 Studios",
      "venture associate Taipei",
      "startup accelerator",
      "Contrary Research",
      "Slug Fund",
      "Korobra Capital",
    ],
  },
  writing: {
    path: "/writing",
    title: "Writing | Carter Wang",
    description:
      "Essays by Carter Wang on human nature, culture, technology, investing, reading, identity, curiosity, and work.",
    keywords: [
      "Carter Wang writing",
      "flying Arrows",
      "Substack essays",
      "technology essays",
      "culture essays",
      "reading lists",
    ],
  },
  projects: {
    path: "/projects",
    title: "Projects | Carter Wang",
    description:
      "Side projects by Carter Wang, including TaipeiFlix, Carter's Taipei Guide, Stocker, Poker Odds Calculator, and other web experiments.",
    keywords: [
      "Carter Wang projects",
      "TaipeiFlix",
      "Carter's Taipei Guide",
      "Stocker app",
      "Poker Odds Calculator",
      "web projects",
    ],
  },
} as const;

type RouteKey = keyof typeof routes;

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}

export function buildMetadata(routeKey: RouteKey): Metadata {
  const route = routes[routeKey];
  const image = {
    ...siteConfig.ogImage,
    url: absoluteUrl(siteConfig.ogImage.url),
  };

  return {
    title: route.title,
    description: route.description,
    keywords: [...route.keywords],
    alternates: {
      canonical: route.path,
    },
    openGraph: {
      title: route.title,
      description: route.description,
      url: route.path,
      siteName: siteConfig.siteName,
      images: [image],
      locale: siteConfig.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: route.title,
      description: route.description,
      images: [image.url],
      creator: "@CarterKoWang",
    },
  };
}

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function jsonLdScript(data: unknown) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: serializeJsonLd(data) },
  };
}

export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteConfig.url}/#person`,
    name: siteConfig.name,
    alternateName: "Carter Ko Wang",
    url: siteConfig.url,
    image: absoluteUrl("/headshot.jpg"),
    email: `mailto:${siteConfig.email}`,
    jobTitle: "Venture Associate",
    description: workPageBio.join(" "),
    homeLocation: {
      "@type": "Place",
      name: "Taipei, Taiwan",
    },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "University of California, Santa Cruz",
    },
    worksFor: {
      "@type": "Organization",
      name: "886 Studios",
      url: "https://886studios.com",
    },
    knowsAbout: workPageSkills.split(",").map((skill) => skill.trim()).filter(Boolean),
    sameAs: [siteConfig.social.x, siteConfig.social.linkedin, siteConfig.social.substack],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.siteName,
    description: siteConfig.description,
    inLanguage: siteConfig.language,
    author: { "@id": `${siteConfig.url}/#person` },
    publisher: { "@id": `${siteConfig.url}/#person` },
  };
}

export function webPageJsonLd(routeKey: RouteKey, type: "WebPage" | "ProfilePage" | "CollectionPage" = "WebPage") {
  const route = routes[routeKey];
  const url = absoluteUrl(route.path);

  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name: route.title,
    description: route.description,
    inLanguage: siteConfig.language,
    isPartOf: { "@id": `${siteConfig.url}/#website` },
    about: { "@id": `${siteConfig.url}/#person` },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absoluteUrl(siteConfig.ogImage.url),
      width: siteConfig.ogImage.width,
      height: siteConfig.ogImage.height,
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function writingItemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl(routes.writing.path)}#writing-list`,
    name: "Carter Wang essays",
    itemListElement: essays.map((essay, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: essay.href,
      item: {
        "@type": "CreativeWork",
        name: essay.title,
        description: essay.subtitle,
        url: essay.href,
        datePublished: toIsoDate(essay.date),
        author: { "@id": `${siteConfig.url}/#person` },
      },
    })),
  };
}

export function projectsItemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl(routes.projects.path)}#project-list`,
    name: "Carter Wang side projects",
    itemListElement: projects.map((project, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: project.href,
      item: {
        "@type": "CreativeWork",
        name: project.title,
        description: project.description,
        url: project.href,
        image: absoluteUrl(project.image),
        creator: { "@id": `${siteConfig.url}/#person` },
      },
    })),
  };
}

function toIsoDate(date: string) {
  const parsed = new Date(`${date} UTC`);

  if (Number.isNaN(parsed.valueOf())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}
