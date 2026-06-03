import Link from "next/link";

type SiteNavProps = {
  active?: "home" | "work" | "writing" | "projects" | "life";
};

const primaryLinks = [
  { id: "work", label: "Work", href: "/work" },
  { id: "writing", label: "Writing", href: "/writing" },
  { id: "projects", label: "Projects", href: "/projects" },
] as const;

const socialLinks = [
  {
    label: "X",
    href: "https://x.com/CarterKoWang",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Email",
    href: "mailto:cartergw01@gmail.com",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 7 10 7 10-7" />
      </svg>
    ),
  },
  {
    label: "Substack",
    href: "https://carterko.substack.com/",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/cartergrantwang",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

function externalLinkProps(href: string) {
  return href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

export default function SiteNav({ active = "home" }: SiteNavProps) {
  return (
    <header className="site-nav">
      <nav aria-label="Primary navigation" className="site-nav-primary">
        {active !== "home" && (
          <Link href="/">Home</Link>
        )}
        {primaryLinks.map((link) => {
          return (
            <Link
              key={link.id}
              href={link.href}
              className={active === link.id ? "is-active" : undefined}
              aria-current={active === link.id ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Social links" className="site-nav-social">
        {socialLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            aria-label={link.label}
            {...externalLinkProps(link.href)}
          >
            {link.icon}
          </a>
        ))}
      </nav>
    </header>
  );
}
