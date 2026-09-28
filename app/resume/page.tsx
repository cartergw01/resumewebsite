import ResumeProfile from "@/components/ResumeProfile";
import SiteNav from "@/components/SiteNav";
import { breadcrumbJsonLd, jsonLdScript, webPageJsonLd } from "@/lib/seo";

export default function ResumePage() {
  return (
    <>
      <script
        {...jsonLdScript([
          webPageJsonLd("resume", "ProfilePage"),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Resume", path: "/resume" },
          ]),
        ])}
      />
      <SiteNav active="resume" />
      <div className="legacy-work-root" data-rocket-launch-zone>
        <ResumeProfile />
      </div>
    </>
  );
}
