# Carter Portfolio

This is Carter Wang's personal website redesign.

Main files:

- `app/page.tsx` loads the immersive landing page.
- `app/work`, `app/writing`, and `app/projects` contain the topic pages.
- `content/portfolio.ts` keeps the page content and project metadata in one place.
- `components/UniverseWorld.tsx`, `ScrollTransport.tsx`, and `SiteNav.tsx` handle the landing page and shared navigation.

To run it locally from this folder:

- `npm run dev -- --hostname 127.0.0.1 --port 3000`

Then open `http://127.0.0.1:3000`.

Before releasing, run `npm run lint`, `npm run build`, and
`npm audit --omit=dev`. To test the production build, start it with
`npm run start -- --hostname 127.0.0.1 --port 3100`, then run
`npm run test:e2e` in another terminal; Playwright reuses that server.
The subscription tests intercept Substack requests so they never create real
subscriptions. The cache-header test checks stable, versioned and hashed assets.

Public media with stable filenames must revalidate before reuse. Only filenames
ending in `-v<number>` or `-<content hash>` receive immutable caching; replace
the filename and its references whenever those assets change. Next.js handles
its own hashed static assets. Existing browser entries cached by an older
release retain their old lifetime, so use a new URL when replacing such an image.

Security overrides keep Next.js 15's pinned PostCSS and the Vercel CLI's pinned
tar/js-yaml packages on patched releases within their existing major versions.
Review these overrides when updating their parent packages. `npm audit` also
checks development tools: Vercel CLI 65.2.0 still pins other dependencies with
upstream advisories. Those findings are separate from the deployed application's
production audit; do not use `npm audit fix --force` to downgrade the CLI or
silently replace its dependencies across major versions.

Social sharing uses a 12-second, silent H.264 camera tour of the site's
islands at 1200 × 630, with a matching JPEG fallback. The sequence establishes
all three worlds, flies into Work, Writing and Projects, then returns to the
opening view. Camera movement and a quiet background starfield create depth;
the islands float freely without connecting trails or orbiting light effects.
The tour uses the current published island artwork as layers in 3D space,
preserving its original lighting and details. Camera travel, a parallax starfield
and gentle floating supply the motion; the artwork keeps its original viewpoint.
The Writing bird comes from the same SVG as the homepage overview. Capturing
does not require the untracked Blender source scenes or a separate lighting bake.
`lib/seo.ts` supplies server-rendered
`og:video` metadata on every public page. Messages can play the direct MP4;
clients that ignore video keep the image, including the X large-image card.
Slack discovers a separate oEmbed photo at `/social-preview-v8.oembed.json`
and automatically animates its 600 × 315 GIF. This avoids replacing the JPEG
that WhatsApp needs. Real desktop self-chat tests on October 26, 2026 confirmed
Messages video autoplay and Slack GIF autoplay. WhatsApp kept a static image;
X Chat kept plain links even with a Player Card. Playback, user preferences and
caching remain controlled by the receiving app.

To refresh the preview after changing the homepage artwork or typography:

1. Start the local site with the latest artwork and choose an unused media version.
2. Run `node scripts/render-social-preview.mjs http://127.0.0.1:3000 v9` with
   Playwright Chromium and FFmpeg installed. Add `--stills` first to review five
   frames in a temporary folder. The capture scene in
   `scripts/social-preview-scene.mjs` uses the artwork in `lib/blender-islands.json` and
   font, including the shared Writing bird anchored to its tree. Set
   `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium installation.
   Its modules are served only inside the capture browser; the production
   site receives only the finished media, with no added client rendering cost.
3. Export a looping GIF from the MP4 using the command below. Copy the oEmbed
   JSON to the new version and update its GIF URL. Update the image, video and
   oEmbed filenames in `siteConfig` in `lib/seo.ts` and the expected filenames
   in `tests/e2e/social-preview.spec.ts`. Media filenames are versioned because
   these assets have immutable caching.
4. Run `npm run test:e2e -- tests/e2e/social-preview.spec.ts`.
5. Deploy the site and check newly shared links in Messages, Slack and WhatsApp.
   Localhost testing verifies metadata and media, but cannot verify another
   app's live unfurl. Existing messages may retain cached previews.

```sh
ffmpeg -i public/social-preview-v9.mp4 -filter_complex '[0:v]fps=12,scale=600:315:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' -loop 0 public/social-preview-v9.gif
```

Reference: [Apple's rich preview guidance](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages).
