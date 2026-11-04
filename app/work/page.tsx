import GalaxyBackground from "@/components/GalaxyBackground";
import WorkRoom from "@/components/WorkRoom";
import SiteNav from "@/components/SiteNav";
import MobileContact from "@/components/MobileContact";
import styles from "@/components/WorkRoom.module.css";
import { breadcrumbJsonLd, jsonLdScript, webPageJsonLd } from "@/lib/seo";

export default function WorkPage() {
  return (
    <>
      <script
        {...jsonLdScript([
          webPageJsonLd("work", "ProfilePage"),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Work", path: "/work" },
          ]),
        ])}
      />
      <div className={styles.page} data-island-page>
        <GalaxyBackground page />
        <SiteNav active="work" />
        <WorkRoom />
        <MobileContact />
      </div>
    </>
  );
}
