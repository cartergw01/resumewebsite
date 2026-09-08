import Image from "next/image";
import Link from "next/link";
import { Afacad, Teko } from "next/font/google";
import HomeCollections from "./HomeCollections";
import nocturne from "@/public/taipei-nocturne-v2.png";
import styles from "./RooftopHome.module.css";

const homeType = Afacad({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-home",
});

const wordmarkType = Teko({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  variable: "--font-wordmark",
});
const routes = [
  { title: "Work", href: "/work" },
  { title: "Writing", href: "/writing" },
  { title: "Projects", href: "/projects" },
];

export default function RooftopHome() {
  return (
    <div className={`${styles.home} ${homeType.variable} ${wordmarkType.variable}`}>
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
            <h1 id="home-title"><span>Carter</span>{" "}<span>Wang</span></h1>
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

        <HomeCollections />
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
