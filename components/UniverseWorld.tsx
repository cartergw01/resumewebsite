import Image from "next/image";
import Link from "next/link";
import { Afacad } from "next/font/google";
import { essays, projects } from "@/content/portfolio";
import nocturne from "@/public/taipei-nocturne-v2.png";
import styles from "./UniverseWorld.module.css";

const homeType = Afacad({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-home",
});

const essay = essays.find((item) => item.title === "Work as Play")!;
const project = projects.find((item) => item.title === "TaipeiFlix")!;
const routes = [
  { title: "Work", href: "/work" },
  { title: "Writing", href: "/writing" },
  { title: "Projects", href: "/projects" },
];

export default function UniverseWorld() {
  return (
    <div className={`${styles.home} ${homeType.variable}`}>
      <main>
        <section className={styles.welcome} aria-labelledby="home-title">
          <div className={styles.painting}>
            <Image
              src={nocturne}
              alt="A painted Taipei night: a desk lamp, a worn basketball court, and the city beyond the rooftop."
              fill
              priority
              quality={86}
              sizes="(max-width: 760px) 130vw, 100vw"
            />
          </div>

          <div className={styles.introduction}>
            <h1 id="home-title">Carter Wang</h1>
            <div className={styles.biography}>
              <p>
                I’m based in Taipei, working at{" "}
                <a href="https://886studios.com" target="_blank" rel="noopener noreferrer">886 Studios</a>{" "}
                alongside the founders of Twitch and Guitar Hero, backing early-stage startups.
              </p>
              <p>On the side, I write and build things for fun.</p>
            </div>
            <nav className={styles.navigation} aria-label="Primary navigation">
              {routes.map((route) => (
                <Link href={route.href} key={route.href}>{route.title}</Link>
              ))}
            </nav>
          </div>
        </section>

        <section className={styles.selected} aria-label="Selected writing and projects">
          <article className={styles.essay}>
            <a href={essay.href} target="_blank" rel="noopener noreferrer" className={styles.essayLink}>
              <p className={styles.publication}>flying Arrows</p>
              <h2>{essay.title}</h2>
              <p className={styles.essayDescription}>{essay.subtitle}</p>
              <span className={styles.readEssay}>Read the essay</span>
            </a>
          </article>

          <article className={styles.project}>
            <a href={project.href} target="_blank" rel="noopener noreferrer" className={styles.projectLink}>
              <div className={styles.projectImage}>
                <Image
                  src={project.image}
                  alt="TaipeiFlix shows films playing in Taipei, with posters, ratings, and showtimes."
                  fill
                  quality={86}
                  sizes="(max-width: 760px) calc(100vw - 48px), 600px"
                />
              </div>
              <div className={styles.projectCaption}>
                <h2>{project.title}</h2>
                <p>Movie showtimes across Taipei.</p>
              </div>
            </a>
          </article>
        </section>
      </main>

      <footer className={styles.footer}>
        <nav aria-label="Social links">
          <a href="mailto:cartergw01@gmail.com">Email</a>
          <a href="https://carterko.substack.com/" target="_blank" rel="noopener noreferrer">Substack</a>
          <a href="https://x.com/CarterKoWang" target="_blank" rel="noopener noreferrer">X</a>
          <a href="https://www.linkedin.com/in/cartergrantwang" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </nav>
        <span>Taipei, Taiwan</span>
      </footer>
    </div>
  );
}
