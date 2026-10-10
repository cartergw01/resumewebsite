import { siteConfig } from "@/lib/seo";
import styles from "./MobileContact.module.css";

// On phones, contact lives after the content so the header has room for routes.
export default function MobileContact() {
  return <footer className={styles.contact}>
    <p>say hi!</p>
    <nav aria-label="Contact">
      <a href={siteConfig.social.x} target="_blank" rel="noopener noreferrer">X</a>
      <a href={`mailto:${siteConfig.email}`}>Email</a>
      <a href={siteConfig.social.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
      <a href={siteConfig.social.substack} target="_blank" rel="noopener noreferrer">Substack</a>
    </nav>
  </footer>;
}
