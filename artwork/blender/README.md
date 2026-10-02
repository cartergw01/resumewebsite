# Blender island artwork

Three editable 3D scenes for the `/2.0` homepage. Geometry, procedural materials,
lighting and camera placement are authored in Blender. No generated images,
external textures or backplates are used in these scenes.

## Art direction

- **Work:** a dense city with varied facades, occupied offices, rooftop equipment,
  a slender Taipei 101, street markings, vehicles and individual tree leaves.
- **Writing:** a walnut study with a stocked bookcase, cloth bindings, curved
  paper leaves, reading glasses, fountain pen and an articulated task lamp.
- **Projects:** an oak workbench with hand tools, parts drawers, laptop, soldering
  station, cables and an electronic prototype with visible components.

The islands share weathered rock ledges, moss, trailing plants and muted
materials. Their silhouettes and projected interaction coordinates come from
the same camera that produces the final images.

## Open and edit

1. In Blender, open `work.blend`, `writing.blend`, or `projects.blend` here.
2. Use camera view to see the website composition. Objects have descriptive
   names so the notebook, screen, tools, buildings and materials can be edited.
3. Render with **Render → Render Image**. Transparent film is enabled.
4. The Writing scene contains a four-second loop on frames 1–48 at 12 fps.
   Its lamp illumination and loose paper move subtly. The camera and notebook
   stay fixed so the website's page transition remains aligned.

These are self-contained scenes, tested with Blender 5.2.2 LTS. The application
and intermediate render frames are not included in this repository.

## Rebuild the set

From the repository root, with Blender and FFmpeg installed:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --threads 4 \
  --python scripts/blender/build_islands.py -- \
  --world all --output .blender-build/final --width 1920 --samples 64 \
  --device CPU --animate

ffmpeg -y -framerate 12 -start_number 1 \
  -i .blender-build/final/writing-frames/%d.png \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 -row-mt 1 \
  -auto-alt-ref 0 -an -metadata:s:v:0 alpha_mode=1 \
  .blender-build/final/writing-loop.webm

ffmpeg -y -framerate 12 -start_number 1 \
  -i .blender-build/final/writing-frames/%d.png \
  -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.85 -pix_fmt bgra \
  -b:v 2400k -tag:v hvc1 -an -movflags +faststart \
  .blender-build/final/writing-loop.mov

node scripts/blender/export_islands.mjs .blender-build/final
```

The second video command uses macOS VideoToolbox to provide Safari's transparent
HEVC format. Chromium uses the transparent VP9 WebM version. Both formats and
all stills receive content hashes so cached media cannot cover a revised scene.

For a quick art-direction check, render one world at `--width 1200 --samples 32`
without `--animate`. Inspect that PNG before running the full export.

The source script is deterministic. Rebuilding replaces the saved scenes, so
save any manually edited variants under another name first.

## Interaction alignment

`lib/blender-islands.json` records camera-projected coordinates for the Taipei
tower, notebook spread, task lamps, laptop screen and selected lights.
`lib/island-artwork.ts` converts these to the SVG transforms used by the hover
and entry effects. Regenerate the metadata whenever a camera or landmark moves.

The page pauses the Writing loop offscreen, in hidden tabs and for reduced-motion
or data-saving preferences. The still image remains the playback fallback.
The background video, scrolling journeys and rocket effect remain independent.
