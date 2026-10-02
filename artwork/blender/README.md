# Blender island artwork

Three original, editable 3D scenes for the `/2.0` homepage. Geometry, materials,
lighting, and camera placement are authored in Blender. No generated images are
used as textures or backplates in these scenes.

## Open and edit

1. In Blender, open `work.blend`, `writing.blend`, or `projects.blend` in this folder.
2. Use camera view to see the website composition. Objects and materials have
   descriptive names: Taipei 101 modules, notebook leaves, lamp arms, pegboard
   tools, laptop screen, and so on.
3. Render with **Render → Render Image**. Transparent film is already enabled.
4. The Writing scene also has a four-second animation on frames 1–48 at 12 fps.
   Its lamp illumination and floating paper move; its camera and notebook stay
   fixed so the website's page transition remains aligned.

These are self-contained scenes: there are no external texture dependencies.
The Blender app itself is not included in this repository.

## Rebuild the set

From the repository root, with Blender installed in `/Applications`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python scripts/blender/build_islands.py -- \
  --world all --output /tmp/carter-islands --width 1600 --samples 48

node scripts/blender/export_islands.mjs /tmp/carter-islands
```

The source script is deterministic. Change its geometry/materials to regenerate
the set, or edit a `.blend` file directly for manual art direction. Rebuilding
from the script replaces the saved scenes, so save manually edited variants
under another name first.

## Interaction alignment

`lib/blender-islands.json` contains the camera-projected coordinates of the
Taipei tower, notebook spread, lamp, laptop screen, and selected lights. These
are produced alongside the renders. `lib/island-artwork.ts` turns the screen
and notebook coordinates into SVG transforms for the existing hover and entry
effects. Keep the camera and those landmarks synchronized when changing a model.

## Writing loop

Render the animation by adding `--animate` to the Writing command:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python scripts/blender/build_islands.py -- \
  --world writing --output /tmp/carter-islands --width 1600 --samples 48 --animate

ffmpeg -framerate 12 -start_number 1 -i /tmp/carter-islands/writing-frames/%d.png \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 -row-mt 1 \
  -auto-alt-ref 0 -an -metadata:s:v:0 alpha_mode=1 \
  public/blender/writing-loop.webm

ffmpeg -framerate 12 -start_number 1 -i /tmp/carter-islands/writing-frames/%d.png \
  -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.85 -pix_fmt bgra \
  -b:v 1800k -tag:v hvc1 -an -movflags +faststart \
  public/blender/writing-loop.mov
```

The web page pauses the loop offscreen, in hidden tabs, and for reduced-motion or
data-saving preferences. The still image remains the fallback when video cannot
play. The background video and rocket effect are independent of these assets.
