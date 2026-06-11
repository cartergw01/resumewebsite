import UniverseWorld from "@/components/UniverseWorld";

export default function Page() {
  return (
    <>
      {/* Preload the hero background — CSS backgrounds are discovered late, so
          this hint moves the fetch earlier for a faster LCP */}
      <link
        rel="preload"
        as="image"
        href="/cosmic-hero-v6-sharp.webp"
        type="image/webp"
      />
      <UniverseWorld />
    </>
  );
}
