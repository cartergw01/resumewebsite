import PortfolioHome from "@/components/PortfolioHome";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import GalaxyBackground from "@/components/GalaxyBackground";
import styles from "@/components/WorkProfile.module.css";
import { breadcrumbJsonLd, jsonLdScript, webPageJsonLd } from "@/lib/seo";
import rooftop from "@/public/taipei-rooftop-v1.png";

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
        <div className={styles.cityView} data-work-scenery aria-hidden="true">
          <Image src={rooftop} alt="" fill priority sizes="100vw" />
        </div>
        <GalaxyBackground page />
        <PortfolioHome />
      </div>
    </>
  );
}
