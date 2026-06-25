import PortfolioHome from "@/components/PortfolioHome";
import SiteNav from "@/components/SiteNav";

export default function WorkPage() {
  return (
    <>
      <SiteNav active="work" />
      <div className="legacy-work-root" data-rocket-launch-zone>
        <PortfolioHome />
      </div>
    </>
  );
}
