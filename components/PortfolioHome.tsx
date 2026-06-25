import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import {
  workPageBio,
  workPageEssays,
  workPageExperience,
  workPageInterests,
  workPageProfileFacts,
  workPageSkills,
} from "@/content/portfolio";
import WorkAtmosphere from "@/components/WorkAtmosphere";

type EssayPreview = {
  href: string;
  subtitle: string;
  title: string;
};

function AnimatedName() {
  return (
    <h1 className="text-4xl font-bold text-[var(--foreground)] sm:text-6xl">
      Carter Wang
    </h1>
  );
}

function EssayRow({ essay, index }: { essay: EssayPreview; index: number }) {
  return (
    <a
      href={essay.href}
      target="_blank"
      rel="noopener noreferrer"
      className="essay-link-row relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl border border-transparent px-3 py-[1rem] no-underline"
    >
      <span className="essay-link-bg pointer-events-none absolute inset-0 rounded-xl bg-[var(--accent-soft)]" />
      <span
        aria-hidden="true"
        className="essay-link-bar pointer-events-none absolute left-0 top-0 h-full w-[2px] origin-top scale-y-0 rounded-l-xl bg-[var(--accent)]"
      />
      <span className="relative z-10 w-7 shrink-0 select-none text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)]">
        {index + 1}
      </span>
      <span className="relative z-10 min-w-0 flex-1">
        <span className="essay-link-title block text-sm font-semibold leading-6 text-[var(--foreground)]">
          {essay.title}
        </span>
        <span className="essay-link-subtitle block overflow-hidden text-xs leading-5 text-[var(--muted)]">
          {essay.subtitle}
        </span>
      </span>
      <span className="essay-link-arrow relative z-10 shrink-0 text-base text-[var(--accent)]" aria-hidden="true">
        &rarr;
      </span>
    </a>
  );
}

function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`scroll-reveal ${className}`}
      style={{ "--reveal-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

function CardShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`work-card-hover h-full ${className}`}>{children}</div>;
}

export default function PortfolioHome() {
  const featuredExperience = workPageExperience[0];
  const earlierExperience = workPageExperience.slice(1);

  return (
    <>
      <WorkAtmosphere />
      <main className="portfolio-shell relative overflow-hidden px-4 pb-12 pt-5 sm:px-6 lg:px-8" style={{ zIndex: 1 }}>
        <div className="accent-halo accent-halo-1 left-[-10rem] top-8 h-72 w-72 bg-[var(--blue-glow)]" />
        <div className="accent-halo accent-halo-2 right-[-5rem] top-24 h-64 w-64 bg-[var(--accent-soft)]" />

        <div className="mx-auto grid max-w-6xl items-stretch gap-2 sm:gap-3 lg:grid-cols-[1.08fr_0.92fr]">
          <ScrollReveal delay={0.05} className="h-full">
            <CardShell className="portfolio-card-strong rounded-[30px] border-none shadow-none">
              <div className="flex h-full flex-col justify-start gap-2 p-4 sm:p-5">
                <AnimatedName />
                <div className="grid gap-2 text-sm leading-[1.7] text-[var(--muted)]">
                  {workPageBio.map((paragraph) => (
                    <p key={paragraph} className="max-w-5xl">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </CardShell>
          </ScrollReveal>

          <div className="min-h-0 overflow-hidden">
            <ScrollReveal delay={0.05} className="h-full">
              <CardShell className="portfolio-card-profile flex items-center rounded-[30px] p-4 sm:p-5">
                <div className="relative h-full min-h-[220px] w-full overflow-hidden rounded-[22px] sm:min-h-[280px] lg:min-h-0">
                  <Image
                    alt="Carter Wang headshot"
                    src="/headshot.jpg"
                    fill
                    priority
                    sizes="(min-width: 1024px) 520px, 100vw"
                    className="object-cover object-[center_25%]"
                  />
                </div>
              </CardShell>
            </ScrollReveal>
          </div>
        </div>

        <div className="mx-auto mt-3 grid max-w-6xl items-start gap-3 lg:items-stretch lg:grid-cols-[1.08fr_0.92fr]">
          <div className="grid gap-3 lg:h-full lg:grid-rows-[auto_1fr]">
            <ScrollReveal delay={0.08}>
              <CardShell className="timeline-featured rounded-[26px] border shadow-none">
                <div className="grid gap-3 p-5">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold text-[var(--foreground)]">{featuredExperience.company}</h2>
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">Associate</p>
                      <p className="shrink-0 text-sm text-[var(--muted)]">{featuredExperience.dates}</p>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm text-[var(--muted)]">Venture Fellow</p>
                      <p className="shrink-0 text-sm text-[var(--muted)]">June 2024 - September 2024</p>
                    </div>
                  </div>
                  <ul className="grid gap-2 text-sm leading-7 text-[var(--foreground)]">
                    {featuredExperience.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-[0.7rem] h-2.5 w-2.5 shrink-0 rotate-45 border-r border-t border-[var(--accent-strong)]"
                        />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardShell>
            </ScrollReveal>

            <ScrollReveal className="h-full">
              <CardShell className="portfolio-card-archive rounded-[26px] border-none shadow-none">
                <div className="flex h-full flex-col gap-4 p-5">
                  <h2 className="text-2xl font-semibold text-[var(--foreground)]">Earlier Experience</h2>
                  <div className="experience-disclosure-list">
                    {earlierExperience.map((item) => (
                      <details
                        key={`${item.company}-${item.role}`}
                        className="experience-disclosure"
                        open={item.company === "Contrary Research"}
                      >
                        <summary>
                          <span className="experience-summary-copy">
                            <span className="flex w-full flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                              <strong className="text-sm font-semibold text-[var(--foreground)]">{item.company}</strong>
                              <span className="shrink-0 text-sm font-normal text-[var(--muted)] sm:text-right">
                                {item.dates}
                              </span>
                            </span>
                            <span className="text-sm text-[var(--muted)]">{item.role}</span>
                          </span>
                          <span className="experience-indicator" aria-hidden="true">
                            &gt;
                          </span>
                        </summary>
                        <div className="pl-8">
                          <ul className="grid gap-2 border-t border-[var(--line)] pt-4 text-sm leading-7 text-[var(--foreground)]">
                            {item.details.map((detail) => (
                              <li key={detail} className="flex items-start gap-3">
                                <span
                                  aria-hidden="true"
                                  className="mt-[0.7rem] h-2.5 w-2.5 shrink-0 rotate-45 border-r border-t border-[var(--accent-strong)]"
                                />
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                          {"links" in item && item.links ? (
                            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--line)] pt-4 text-sm">
                              {item.links.map((article) => (
                                <a
                                  key={article.href}
                                  href={article.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[var(--foreground)] underline decoration-[var(--accent)]/60 underline-offset-4 transition-opacity hover:opacity-75"
                                >
                                  {article.label}
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </CardShell>
            </ScrollReveal>
          </div>

          <div className="grid gap-3 lg:h-full lg:grid-rows-[auto_1fr]">
            <ScrollReveal delay={0.1}>
              <CardShell className="portfolio-paper relative overflow-hidden rounded-[26px] border-none shadow-none">
                <div className="pointer-events-none absolute right-[-3rem] top-6 h-28 w-28 rounded-full bg-[rgba(255,168,103,0.22)] blur-3xl" />
                <div className="relative flex h-full flex-col p-5 lg:p-6">
                  <div className="mb-1">
                    <h2 className="text-2xl font-semibold text-[var(--foreground)]">Essays</h2>
                    <div className="mt-3 h-px bg-[var(--line)]" />
                  </div>

                  <div className="mt-1 flex flex-col gap-1">
                    {workPageEssays.map((essay, index) => (
                      <EssayRow key={essay.title} essay={essay} index={index} />
                    ))}
                  </div>

                  <div className="mt-2 border-t border-[var(--line)] pt-2">
                    <a
                      href="https://carterko.substack.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="essay-link-row relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl border border-transparent px-3 py-3 no-underline"
                    >
                      <span className="essay-link-bg pointer-events-none absolute inset-0 rounded-xl bg-[var(--accent-soft)]" />
                      <span
                        aria-hidden="true"
                        className="essay-link-bar pointer-events-none absolute left-0 top-0 h-full w-[2px] origin-top scale-y-0 rounded-l-xl bg-[var(--accent)]"
                      />
                      <span className="relative z-10 flex-1 text-[11px] tracking-[0.14em] text-[var(--muted)]">
                        Read more on Substack
                      </span>
                      <span className="essay-link-arrow relative z-10 shrink-0 text-base text-[var(--accent)]" aria-hidden="true">
                        &rarr;
                      </span>
                    </a>
                  </div>
                </div>
              </CardShell>
            </ScrollReveal>

            <ScrollReveal className="h-full">
              <CardShell className="portfolio-card-profile rounded-[30px] border-none shadow-none">
                <div className="flex h-full flex-col gap-5 p-5 sm:p-6">
                  <div className="grid gap-4">
                    {workPageProfileFacts.map((fact) => (
                      <div key={fact.label} className="border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0">
                        <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">{fact.label}</p>
                        <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">{fact.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3">
                    <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">Skills</p>
                    <p className="text-sm leading-[1.75] text-[var(--foreground)]">{workPageSkills}</p>
                  </div>
                  <div className="grid gap-3">
                    <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">Interests</p>
                    <p className="text-sm leading-[1.75] text-[var(--foreground)]">{workPageInterests}</p>
                  </div>
                </div>
              </CardShell>
            </ScrollReveal>
          </div>
        </div>
      </main>
    </>
  );
}
