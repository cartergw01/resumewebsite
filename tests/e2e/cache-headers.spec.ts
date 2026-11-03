import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const manifest = (name: string) => JSON.parse(readFileSync(new URL(`../../lib/${name}.json`, import.meta.url), "utf8"));
const islands = manifest("blender-islands");
const flights = manifest("island-flight-assets");
const environment = manifest("workshop-environment");

test("stable media URLs revalidate while versioned and hashed assets stay immutable", async ({ request }) => {
  const assets = [
    ["/headshot.jpg", false],
    ["/favicon-32x32.png", false],
    ["/essay-covers/work-as-play.webp", false],
    ["/social-preview-v7.gif", true],
    ["/starfield-loop-desktop-v1.mp4", true],
    [islands.work.src, true],
    [flights.projects.src, true],
    [environment.src, true],
  ] as const;
  for (const [url, immutable] of assets) {
    const response = await request.head(url);
    expect(response.status(), url).toBe(200);
    expect(response.headers()["cache-control"], url).toBe(immutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate");
  }
});
