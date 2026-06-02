import Link from "next/link";

type SiteNavProps = {
  active?: "home" | "work" | "writing" | "projects" | "life";
};

const primaryLinks = [
  { id: "work", label: "Work", href: "/work" },
  { id: "writing", label: "Writing", href: "/writing" },
  { id: "projects", label: "Projects", href: "/projects" },
  { id: "life", label: "Life", href: "/life" },
] as const;

const socialLinks = [
  { label: "X", href: "https://x.com/CarterKoWang" },
  { label: "Email", href: "mailto:cartergw01@gmail.com" },
  { label: "Substack", href: "https://carterko.substack.com/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/cartergrantwang" },
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
          <a key={link.label} href={link.href} {...externalLinkProps(link.href)}>
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
