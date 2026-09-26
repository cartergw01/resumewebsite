import PortfolioHome from "@/components/PortfolioHome";
import SiteNav from "@/components/SiteNav";
import GalaxyBackground from "@/components/GalaxyBackground";
import styles from "@/components/WorkProfile.module.css";
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
        <GalaxyBackground page />
        <PortfolioHome />
      </div>
    </>
  );
}
