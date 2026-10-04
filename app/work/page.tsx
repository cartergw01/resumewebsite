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
      <div className={styles.page} data-rocket-launch-zone data-island-page>
        <SiteNav active="work" />
        <WorkRoom />
        <MobileContact />
      </div>
    </>
  );
}
