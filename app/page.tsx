import UniverseWorld from "@/components/UniverseWorld";

export default function Page() {
  return (
    <>
      {/* Preload the hero background — CSS backgrounds are discovered late, so
          this hint moves the fetch earlier. fetchPriority high marks it as the
          LCP resource so the browser fetches it ahead of lower-priority assets. */}
      <link
        rel="preload"
        as="image"
        href="/cosmic-hero-v6-sharp.webp"
        type="image/webp"
        fetchPriority="high"
      />
      <UniverseWorld />
    </>
  );
}
