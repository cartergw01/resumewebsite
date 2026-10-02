# Blender island artwork

Three editable Blender scenes for the `/2.0` homepage. Geometry, materials,
lighting and a 70mm perspective camera are authored in
`scripts/blender/build_islands.py`. The final images are rendered from these
scenes; no generated image backplates are used.

## Art direction and references

- **Work:** a compressed Xinyi scene with Taipei 101, its adjoining mall, the
  World Trade Center courtyard, Grand Hyatt massing, Nan Shan's paired crown,
  streets, low-rise frontage, roof equipment, street trees and vehicles.
  Taipei 101 uses eight equal eight-floor modules above a separate inward
  tapering base, smaller glazing, narrow mullions, corner details and a distinct
  observation crown and spire. One scene unit represents approximately 100m.
- **Writing:** a study with slim walnut furniture, a usable upholstered chair,
  built-in bookshelves, a framed window, normally proportioned notebook, mug,
  spectacles, fountain pen and a task lamp. Two scene units represent one metre.
- **Projects:** a working studio with a steel-framed bench, tool panel, labelled
  storage, an open electronics enclosure, circuit-board components, soldering
  station, cables, caliper and laptop. It uses the same furniture scale.

The sky shader provides reflections; broad, neutral daylight keeps the matte
surfaces readable, with local lights illuminating the working surfaces. The
camera uses perspective without miniature depth-of-field blur.

The shared foundation has chipped stone faces, an uneven soil rim, continuous
moss patches, embedded gravel, fine grass and exposed roots. Walnut, oak and
reclaimed floorboards have directional grain and varying roughness. Lime plaster,
flax cloth, worn leather and unglazed terracotta keep the interiors earthy;
architectural glass and bare metal retain their distinct reflective finish.
All materials are procedural and editable in the saved scenes.

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
4. Writing has a four-second loop on frames 1–48 at 12 fps. Its lamp and loose
   correspondence move subtly; the notebook and camera remain fixed.

Scenes are tested with Blender 5.2.2 LTS, Cycles CPU. Intermediate renders are
ignored by Git. Save manually edited variants under another name before
rebuilding, because the script replaces the three saved scenes.

## Rebuild

From the repository root, with Blender and FFmpeg installed:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --threads 4 \
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
For a quick check, render one world at `--width 1400 --samples 40` without
`--animate`, and inspect the PNG before rendering the loop.

## Interaction alignment

`lib/blender-islands.json` records projected coordinates for landmarks, lights,
and all four corners of the physical notebook and screen. Regenerate it whenever
a camera or landmark moves. The site projects live SVG artwork onto those
surfaces and carries the same perspective into the destination transition.

`lib/artwork-perspective.ts` calculates the projection;
`components/PerspectiveArtwork.tsx` renders it with clipped SVG triangles, which
work in both Chromium and WebKit. Entry animations use the corresponding CSS
projective matrix. The regression test checks all four corners of a tilted plane.

The Writing video pauses offscreen, in hidden tabs, and for reduced-motion or
save-data preferences. The still remains the playback fallback. The background
video, scrolling journeys and rocket effect are independent.
