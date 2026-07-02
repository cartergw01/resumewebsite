import PortfolioHome from "@/components/PortfolioHome";
import SiteNav from "@/components/SiteNav";
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
      <SiteNav active="work" />
      <div className="legacy-work-root" data-rocket-launch-zone>
        <PortfolioHome />
      </div>
    </>
  );
}
