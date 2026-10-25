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

Social sharing uses a 12-second, silent H.264 camera tour of the site's 3D
islands at 1200 × 630, with a matching JPEG fallback. The sequence establishes
all three worlds, flies into Work, Writing and Projects, then returns to the
opening view. Camera movement and a quiet background starfield create depth;
the islands float freely without connecting trails or orbiting light effects.
All island lights stay on. Capture models preserve the original emissive bulbs,
windows, LED strips and screens separately from the baked surroundings, with
denser geometry to retain the lamps' light pools. Rendering uses the site's
exposure, multisampled antialiasing, and a restrained glow on the fixtures only.
Walls, roofs and book pages are excluded from that glow, and no moving brightness
overlay is applied.
`lib/seo.ts` supplies server-rendered
`og:video` metadata on every public page. Messages can play the direct MP4;
clients that ignore video keep the image, including the X large-image card.
Playback and caching are controlled by the receiving app.

To refresh the preview after changing the homepage artwork or typography:

1. Prepare the capture models from the saved Blender scenes (repeat when the
   models or lighting change). For each of `work`, `writing`, and `projects`, run
   `blender -b artwork/blender/NAME.blend --python scripts/blender/export_flight.py -- --world NAME --social-preview --faces 220000 --samples 48`.
   This writes only to `.blender-build/social-preview`; it does not replace the
   live site's lighter flight models. On macOS the Blender executable may be
   `/Applications/Blender.app/Contents/MacOS/Blender`.
2. Start the local site.
3. Run `node scripts/render-social-preview.mjs http://127.0.0.1:3000 v7` with
   Playwright Chromium and FFmpeg installed. Add `--stills` first to review five
   frames in a temporary folder. The capture scene in
   `scripts/social-preview-scene.mjs` uses the site's existing GLB models and
   font. Its modules are served only inside the capture browser; the production
   site receives only the finished media, with no added client rendering cost.
4. Update both media filenames in `siteConfig` in `lib/seo.ts` and the expected
   filenames in `tests/e2e/social-preview.spec.ts` to the new version. Media
   filenames are versioned because these assets have immutable caching.
5. Run `npm run test:e2e -- tests/e2e/social-preview.spec.ts`.
6. Deploy the site and check a newly shared link in Messages. Localhost testing
   verifies metadata and playback, but cannot verify another app's live unfurl.

Reference: [Apple's rich preview guidance](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages).
