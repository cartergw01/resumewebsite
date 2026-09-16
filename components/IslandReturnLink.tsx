import Link from "next/link";
import styles from "./IslandReturnLink.module.css";

export default function IslandReturnLink({ island }: { island: "work" | "writing" | "projects" }) {
  return <Link href={`/2.0#${island}`} className={styles.link}><span aria-hidden="true">←</span> Back to islands</Link>;
}
