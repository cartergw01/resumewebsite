# Blender island artwork

Three editable Blender scenes for the `/2.0` homepage. Geometry, materials,
lighting and a 70mm perspective camera are authored in
`scripts/blender/build_islands.py`. The final images are rendered from these
scenes; no generated image backplates are used.

## Art direction and references

- **Work:** a compressed Xinyi scene with Taipei 101, its adjoining mall, the
  World Trade Center courtyard, Grand Hyatt massing, Nan Shan's paired crown,
  streets, planted pedestrian plazas, sidewalks, low-rise frontage, roof equipment,
  street trees, yellow taxis, scooter parking and Xinyi/Songzhi road signs.
  Taipei 101 uses eight equal eight-floor modules above a separate inward
  tapering base, smaller glazing, narrow mullions, corner details and a distinct
  observation crown and spire. One scene unit represents approximately 100m.
  Connected neighborhoods occupy the western, eastern and northern shoulders.
  Narrow shopfronts have covered ground-floor arcades, recessed windows,
  different balcony arrangements, external air conditioning, parapets, water
  tanks and irregular roof extensions. Three supporting office silhouettes
  bridge the low-rise fabric and landmark towers. A planted promenade follows
  the front edge. These surrounding blocks are composed interpretations, not
  additional surveyed replicas of named buildings.
- **Writing:** a study with slim walnut furniture, a usable upholstered chair,
  open bookshelves, a sheltered reading garden, low stone walls, trellis,
  a framed window, an open notebook, mug,
  spectacles, fountain pen and a task lamp. Two scene units represent one metre.
- **Projects:** a working studio with a steel-framed bench, tool panel, labelled
  storage, an open electronics enclosure, circuit-board components, soldering
  station, cables, caliper and a 27-inch monitor. The workbench turns toward the
  visitor; the lower tool wall and open storage leave the screen prominent.
  Worn paving and steps lead past reclaimed lumber, offcuts and a cable reel.
  It uses the same furniture scale.

The sky shader provides reflections; broad, neutral daylight keeps the matte
surfaces readable, with local lights illuminating the working surfaces. The
camera uses perspective without miniature depth-of-field blur.

The shared foundation has chipped stone faces, an uneven soil rim, continuous
moss patches, embedded gravel, fine grass and exposed roots. Walnut, oak and
reclaimed floorboards have directional grain and varying roughness. Lime plaster,
flax cloth, worn leather and unglazed terracotta keep the interiors earthy;
architectural glass and bare metal retain their distinct reflective finish.
Surface materials are procedural and editable in the saved scenes. Physical
prints use packed copies of Carter’s existing site assets: the workshop displays
TaipeiFlix and Taipei Run screenshots; bound journals show the covers and titles
of the latest three essays in `content/portfolio.ts`: “The Cost of Keeping Up,”
“Slop and Spiral,” and “We All Have Superpowers.” Reading-list roundups are
excluded, matching the Writing page’s essay grouping.

The refinement pass gives each cliff an irregular plan, warped sedimentary
ledges, recessed seams and vertical faults. Material variation follows mineral
pockets instead of painting uniform stripes around the whole island. Planting
uses actual clustered grass blades with bare earth between drifts. City paving,
rocks, benches and planting have their own architectural scale; the Work scene
also includes recessed upper storeys, balcony rails and grouped office lighting.

The notebook has 22 curved sheets per side, uneven cut edges, a recessed cloth
spine and a gently lifting corner. Its projected live content stays anchored to
the fixed readable part of the page. The rug has a soft, irregular selvedge,
visible warp, loose fringe and a crossing weave shader. Sawn board ends use ring
grain. The workshop replaces repeated empty bins with a compartmented parts
tray, cable coil and canvas tool roll; one drawer is open and offcuts lie beside
the timber stack. The three essay journals and the real project prints remain.

Every foundation uses the same proportions: the terrain is 35% wider and deeper
in plan, and the cliff is 18% taller than the original earthy version. Buildings
and furniture retain their size. The interiors use the extra land for soil and
vegetation around the central plot. Work extends its streets and building plots
into that land, with a narrower planted perimeter around the larger district.
Shared elevation noise raises the outer shoulders; paths, embedded bedrock and
planting follow the same surface. A smaller broad key creates contact shadows,
local warm lamps light the book and bench, and a cool rim separates the cliffs.

### Architectural reference sources

1. [C.Y. Lee & Partners — Taipei 101](https://www.cylee.com/project/Taipei-101?lang=en):
   508m height, eight-floor repeating structure, distinct lower and upper forms,
   corner motifs and round-and-square emblems.
2. [Taipei 101 — Design and structure](https://www.taipei-101.com.tw/en/concept/structure):
   official photographs, glazing, module silhouette and lighting references.
3. [Mitsubishi Jisho Design — Taipei Nanshan Plaza](https://www.mjd.co.jp/en/projects/27998/):
   Nan Shan’s height, folded shaft, paired crown blades and planted retail terraces.

This is an architectural interpretation on a floating island, not a surveyed
city model. Street spacing and surrounding building massing are compressed to
fit the composition. Facades are modelled approximations. Reference photographs
are not included or used as image textures.

## Open and edit

1. Open `work.blend`, `writing.blend`, or `projects.blend` in Blender.
2. Use camera view for the website composition. Objects have descriptive names.
3. Render with **Render → Render Image**. Transparent film is enabled.
4. Writing has a four-second loop on frames 1–48 at 12 fps. Its lamp, loose
   correspondence, page corner and plant leaves move subtly; the ground, camera
   and reading surface remain fixed. Frame 49 matches frame 1 for seamless
   repetition. Work adds an occasional pair of headlights along a projected
   foreground street. The workshop screen varies its light slightly while
   preserving the project that carries into the destination. These browser
   details pause offscreen, during entry, and when motion is reduced.

Scenes are tested with Blender 5.2.2 LTS, Cycles CPU. Intermediate renders are
ignored by Git. Save manually edited variants under another name before
rebuilding, because the script replaces the three saved scenes.

## Rebuild

From the repository root, with Blender and FFmpeg installed:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --threads 6 \
  --python scripts/blender/build_islands.py -- \
  --world all --output .blender-build/final --width 1920 --samples 72 \
  --device CPU --animate

node scripts/blender/prepare_islands.mjs .blender-build/final .blender-build/web

ffmpeg -y -framerate 12 -start_number 1 \
  -i .blender-build/web/writing-frames/%d.png \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 -row-mt 1 \
  -auto-alt-ref 0 -an -metadata:s:v:0 alpha_mode=1 \
  .blender-build/web/writing-loop.webm

ffmpeg -y -framerate 12 -start_number 1 \
  -i .blender-build/web/writing-frames/%d.png \
  -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.85 -pix_fmt bgra \
  -b:v 2400k -tag:v hvc1 -an -movflags +faststart \
  .blender-build/web/writing-loop.mov

node scripts/blender/export_islands.mjs .blender-build/web
```

The preparation step removes excess transparent margin from stills and video
frames and applies the same crop to interaction coordinates. Raw camera renders
remain available in the input directory.

Safari uses transparent HEVC; Chromium uses transparent VP9. Both video formats
and the stills receive content hashes to avoid stale media after a revision.
The server passes the same artwork manifest and landmark coordinates into the
overview and interactive scenes. A new render remounts its media component so
the Writing video, still, and book projection update together.
For a quick check, render one world at `--width 1400 --samples 40` without
`--animate`, and inspect the PNG before rendering the loop.

To revise Work alone, render with `--world work`, then prepare and export only
that world. The other worlds and the Writing video retain their existing files
and coordinates:

```sh
node scripts/blender/prepare_islands.mjs .blender-build/work-final .blender-build/work-web --world work
node scripts/blender/export_islands.mjs .blender-build/work-web --world work
```

Both scripts also accept `--world projects` or `--world writing`. Writing still
requires all 48 animation frames during preparation and both encoded video
formats during export, so its still, loop and interaction anchors stay together.

## Interaction alignment

`lib/blender-islands.json` records projected coordinates for landmarks, lights,
the eight Taipei 101 tiers, and all four corners of the tower window, notebook,
and screen. Regenerate it whenever
a camera or landmark moves. The site projects live SVG artwork onto those
surfaces and carries the same perspective into the destination transition.

`lib/artwork-perspective.ts` calculates the projection;
`components/PerspectiveArtwork.tsx` renders it with clipped SVG triangles, which
work in both Chromium and WebKit. Entry animations use the corresponding CSS
projective matrix. The regression test checks all four corners of a tilted plane.

Work's entry uses `lib/work-window-camera.ts` to borrow the active island's
renderer and move its camera through one illuminated south-facing office window.
The starting projection includes the island's current orbit and CSS placement.
The camera approaches the facade and its metal frame passes outside the viewport.
`lib/work-entry.ts` clips the actual opening components from `/work` to the
window's projected corners; text stays in its final layout throughout the reveal.
There is no separate floating pane, tier-light sequence or spark docking.

`lib/island-orbit-assets.json` stores the window's four world-space corners in
Three coordinates (Blender X, Z, -Y). `lib/blender-islands.json` stores their
1200×800 projection for the still. Update both when changing the tower/window;
the rebuild formula is in `taipei101` in `build_islands.py`. The exporter preserves
these entry coordinates when refreshing a model. No additional model is loaded
for the entry. If the existing GLB is unavailable, the still and opening zoom
together. Reduced motion skips the approach; Escape, resize, and back cancel it.
The renderer survives route unmount just until the matching page content mounts,
then releases its GPU resources. `tests/e2e/work-entry.spec.ts` checks orbit
alignment, viewport coverage, content continuity, fallback and interruption.

The Writing video pauses offscreen, in hidden tabs, and for reduced-motion or
save-data preferences. The still remains the playback fallback. The background
video, scrolling journeys and rocket effect are independent.

## Interactive angles

The homepage's three detailed islands also have compressed GLB versions.
`components/IslandOrbit.tsx` loads the active world's model after its journey
settles. Its poster/video stays visible until a drag or arrow-key interaction.
Horizontal touch drags turn the model; vertical swipes retain native scrolling.
Drag release never opens a page. Click or Enter still uses the landmark entry
and rocket. R or the reset button restores the original rendered view.

Regenerate a model from its editable Blender source:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b artwork/blender/work.blend --threads 6 --python scripts/blender/export_orbit.py -- --world work
```

Repeat with `writing` or `projects`. This saves an intermediate scene under
`.blender-build/orbit`, writes a hashed GLB to `public/blender`, and updates
`lib/island-orbit-assets.json`. The original `.blend` stays untouched. If the
camera framing changes, pass `--crop X Y WIDTH HEIGHT` using the 1200×800 crop
printed by `prepare_islands.mjs`; otherwise the current manifest crop is kept.
Remove superseded GLBs after checking the new model in the browser.

The exporter joins detailed geometry, bakes procedural base colors, preserves
image planes and surface roughness, and uses Draco compression. Lighting and
fine wood/stone grain run in the browser; they approximate the offline Cycles
render, so a live angle is not pixel-identical to the still. Models currently
range from about 3–7 MiB. They load per active world, render only on input or
resize, and release GPU resources when another world finishes arriving.
Save-data, unsupported WebGL, failed downloads, or context loss retain the
original artwork and normal navigation. Manual rotation also works with reduced
motion, with no automatic orbit or inertial spin.

`lib/island-orbit.ts` recovers the 3D surface beneath each projected landmark by
raycasting, then updates the annotation and entry corners while turning. The
workshop's project preview stays attached to its screen. Tests in
`tests/e2e/island-orbit.spec.ts` cover drag/click separation, all three destinations,
keyboard controls, reset, reduced motion, failed downloads, and native touch
scrolling. The Draco files under `public/draco` come from the installed Three.js
package; their licenses are included there.
