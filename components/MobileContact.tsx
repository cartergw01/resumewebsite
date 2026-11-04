import { socialLinks } from "./socialLinks";
import styles from "./MobileContact.module.css";

// On phones, contact lives after the content so the header has room for routes.
// Same icons as the header, so the row reads the same on every page.
export default function MobileContact() {
  return <footer className={styles.contact}>
    <p>say hi!</p>
    <nav aria-label="Contact">
      {socialLinks.map((link) => (
        <a
          key={link.label}
          href={link.href}
          aria-label={link.label}
          {...(link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {link.icon}
        </a>
      ))}
    </nav>
  </footer>;
}
