import { expect, test } from "@playwright/test";

// Assert the public sharing contract independently of Next's static-image imports.
const siteConfig = {
  url: "https://carterkowang.com",
  image: {
    url: "/social-preview-v6.jpg",
    alt: "Carter Wang beside three floating islands for Work, Writing and Projects against a starfield",
  },
  video: { url: "/social-preview-v6.mp4" },
  oembedUrl: "/social-preview-v7.oembed.json",
};
const routes = [
  { path: "/", title: "Carter Wang" },
  { path: "/work", title: "Work | Carter Wang" },
  { path: "/writing", title: "Writing | Carter Wang" },
  { path: "/projects", title: "Projects | Carter Wang" },
  { path: "/resume", title: "Resume | Carter Wang" },
];

test("sharing crawlers receive video metadata and a complete image fallback without JavaScript", async ({ request }) => {
  for (const route of routes) {
    const response = await request.get(route.path, {
      headers: { "User-Agent": "facebookexternalhit/1.1" },
    });
    expect(response.ok()).toBe(true);
    const html = await response.text();
    const head = html.slice(0, html.indexOf("</head>"));
    const tags = new Map(Array.from(head.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g),
      (match) => [match[1], match[2]]));

    expect(tags.get("og:title")).toBe(route.title);
    expect(tags.get("og:url")).toBe(`${siteConfig.url}${route.path === "/" ? "" : route.path}`);
    expect(tags.get("og:type")).toBe("website");
    expect(tags.get("og:video")).toBe(`${siteConfig.url}${siteConfig.video.url}`);
    expect(tags.get("og:video:secure_url")).toBe(tags.get("og:video"));
    expect(tags.get("og:video:type")).toBe("video/mp4");
    expect(tags.get("og:video:width")).toBe("1200");
    expect(tags.get("og:video:height")).toBe("630");
    expect(tags.get("og:image")).toBe(`${siteConfig.url}${siteConfig.image.url}`);
    expect(tags.get("og:image:width")).toBe("1200");
    expect(tags.get("og:image:height")).toBe("630");
    expect(tags.get("og:image:alt")).toBe(siteConfig.image.alt);
    expect(tags.get("twitter:card")).toBe("summary_large_image");
    expect(tags.get("twitter:image")).toBe(tags.get("og:image"));
    expect(tags.get("twitter:image:alt")).toBe(siteConfig.image.alt);
    const discovery = head.match(/<link\s+rel="alternate"\s+type="application\/json\+oembed"\s+href="([^"]+)"/);
    expect(discovery?.[1]).toBe(`${siteConfig.url}${siteConfig.oembedUrl}`);
  }

  const video = await request.get(siteConfig.video.url);
  expect(video.ok()).toBe(true);
  expect(video.headers()["content-type"]).toContain("video/mp4");
  const poster = await request.get(siteConfig.image.url);
  expect(poster.ok()).toBe(true);
  expect(poster.headers()["content-type"]).toContain("image/jpeg");
  // Leave ample room below Apple's 10 MB total preview-resource guideline.
  expect((await video.body()).byteLength + (await poster.body()).byteLength).toBeLessThan(5_000_000);
  const range = await request.get(siteConfig.video.url, { headers: { Range: "bytes=0-1023" } });
  expect(range.status()).toBe(206);
  expect((await range.body()).byteLength).toBe(1024);
});

test("the Slack oEmbed points to a public looping GIF without replacing OG images", async ({ request }) => {
  const response = await request.get(siteConfig.oembedUrl);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/json");
  const embed = await response.json();
  expect(embed).toMatchObject({
    version: "1.0", type: "photo", title: "Carter Wang",
    url: `${siteConfig.url}/social-preview-v7.gif`, width: 600, height: 315,
  });
  const media = await request.get(new URL(embed.url).pathname);
  expect(media.ok()).toBe(true);
  expect(media.headers()["content-type"]).toContain("image/gif");
  const bytes = await media.body();
  expect(bytes.subarray(0, 6).toString()).toBe("GIF89a");
  expect([bytes.readUInt16LE(6), bytes.readUInt16LE(8)]).toEqual([embed.width, embed.height]);
  expect(bytes.includes(Buffer.from("NETSCAPE2.0"))).toBe(true);
  expect(bytes.byteLength).toBeLessThan(5_000_000);
});

// This harness verifies the media itself; actual chat autoplay needs self-chat tests.
test("the sharing MP4 decodes, animates and loops with its matching poster", async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // A local playback harness isolates the media from the live site's effects.
  await page.route("**/__social-preview-test", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><title>Sharing preview</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body { margin: 0; background: #030611; } video { display: block; width: 100%; }</style>
    <video controls muted autoplay loop playsinline preload="auto"
      poster="${baseURL}${siteConfig.image.url}" src="${baseURL}${siteConfig.video.url}"></video>`,
  }));
  await page.goto("/__social-preview-test", { waitUntil: "domcontentloaded" });
  const video = page.locator("video");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(2);
  expect(await video.evaluate((node: HTMLVideoElement) => [node.videoWidth, node.videoHeight])).toEqual([1200, 630]);
  expect(await video.evaluate((node: HTMLVideoElement) => node.duration)).toBeCloseTo(12, 1);
  await video.evaluate((node: HTMLVideoElement) => node.play());
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.2);

  const frame = () => video.evaluate((node: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 315;
    canvas.getContext("2d")!.drawImage(node, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL();
  });
  const first = await frame();
  await video.evaluate((node: HTMLVideoElement) => { node.currentTime = 6; });
  await expect.poll(frame).not.toBe(first);
  await video.evaluate((node: HTMLVideoElement) => { node.currentTime = 11.8; });
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeLessThan(2);
  expect(await video.evaluate((node: HTMLVideoElement) => node.error)).toBeNull();
  expect(errors).toEqual([]);
});
