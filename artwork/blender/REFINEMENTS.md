# Island refinements — October 21, 2026

The switches in `scripts/blender/island-refinements.json` apply only when
building artwork. They add no browser code or runtime controls. Personal
objects, real project screenshots, essay covers and writing are preserved.
No subpage source, content, or layout is part of this change.

For a selective revert, set the named switch to `false`, then rebuild that
island with `scripts/blender/pipeline.sh projects`, `writing`, or `work`.
A shared switch requires rebuilding all three. Always run the complete
pipeline: it keeps stills, lighting variants, light masks, depth, cameras,
anchors and flight meshes together. Do not replace a still alone.

## Projects

1. `screen_focus`: darker backing behind the monitor, more reflected screen
   light on the desk, softer task lighting and a quieter desk lamp.
2. `court`: wider playing surface, slightly lower hoop, lower slab and an
   approach from the deck; softer floodlight, richer gold, quieter paint and
   backboard. The Wilson ball follows the new surface height.
3. `shield`: oblique placement clear of the bench leg, darker crimson and
   softer silver reflections. Rings, star, grips and floor contact remain.
4. `collectibles`: graphite shelf finish, clearer separation of the
   Cybertruck and JBL speaker, softer Lugia finish and light-stick glow.
5. `jersey`: shallow folds through the jersey and its lettering together,
   separation from the backing and subtle protective glazing. Kobe's gold
   BRYANT 24 design stays intact.
6. `roof`: softer zinc reflections, smoother corrugation and weathered
   fasteners.
7. `scooter`: slightly farther inside the island, with its tire contacts
   recalculated, and a lighter satin frame.
8. `deck_lighting`: recessed purple strips behind a wooden fascia and a
   broader, weaker wash onto the ground.
9. `device_materials`: lower iPad brightness, softer headphone metal and
   separate satin keyboard caps. The launch wallpaper is unchanged.

## Writing

1. `notebook_focus`: lamp aimed toward the notebook, a soft bounce onto the
   pages, larger/heavier real essay title and darker ink; cooler, softer
   window-side illumination when the room lights are off.
2. `desk_spacing`: book stack farther back/right and loose drafts shifted
   away from the notebook.
3. `bookshelves`: modest book leaning/depth variation, warmer paper edges
   and softer shelf lights. All three real essay covers remain.
4. `sconce`: lower intensity and broader edges on the upward/downward beams.
5. `garden`: fewer, smaller maple leaves with softer highlights; more
   variation in wax-apple size, angle and visibility.
6. `rug`: flatter wool surface, local corner lifts, a thicker edge and
   slight compression beneath the chair.
7. `lounge`: softer leather grain/reflections and less glaring aluminium.

## Work

1. `building_families`: four neighborhood families with distinct width,
   depth, height and facade materials inside the existing plots.
2. `tower_plaza`: lower foreground buildings and an entrance forecourt,
   canopy and low planting in front of Taipei 101.
3. `glazing`: more reflective tower glass and dimmer neighboring office
   windows; the tower keeps its evenly lit curtain wall.
4. `street_connections`: paving and occasional planters connecting
   neighborhood entrances to their immediate street frontage.
5. `hill`: more varied Xiangshan ridgeline and planting, a connected
   approach path and dimmer trail lights.
6. `day_materials`: warmer mineral facades, darker asphalt and clearer
   glass reflections in the daytime variant.
7. `traffic_hierarchy`: quieter baked traffic trails and moving traffic on
   the two main roads, reducing the moving car count.

The longer interval between ambient fireworks is a separate homepage
change in `components/CityFireworks.tsx`: 24–32 seconds instead of 15–18.
The immediate entry burst and all offscreen/reduced-motion guards remain.
Reverting this interval does not require rebuilding artwork.

## Shared

1. `geology`: locally broken mineral beds and a darker underside.
2. `roots`: tapered, curved hanging roots with tapering branches.
3. `planting`: clustered vegetation with deliberate bare areas.
4. `silhouette`: a wider reconstruction filter at the existing render
   resolution, keeping narrow edges clean without bigger browser textures.

The pre-change source and published assets are preserved in
`output/island-refinement-2026-10-21/baseline.tar.gz`, with a SHA-256 manifest.
This snapshot includes changes that were already present before this pass;
do not use a broad Git reset to undo these refinements.

## Asset size and compatibility

Sizes below include all on-demand variants, light masks, depth maps and flight
models; they are not the initial page download.

| Island | Before | After | Change |
| --- | ---: | ---: | ---: |
| Projects | 2.17 MB | 1.99 MB | −8.45% |
| Writing | 3.81 MB | 3.93 MB | +3.12% |
| Work | 3.08 MB | 3.07 MB | −0.41% |
| Total | 9.06 MB | 8.98 MB | −0.85% |

The asset set remains 16 images and 4 compressed models. Every image retains
its original dimensions and transparency format. Flight meshes retain the
45,000-face Blender export budget; all four final meshopt models successfully
decode with finite positions and baked vertex colors. The frontend gains no
dependencies, lighting systems, animation systems or texture resolution.

Production build, TypeScript, modified-component lint and patch whitespace
checks passed during the artwork pass. For the production release, five old
audit utilities were converted from CommonJS to ES modules, resolving their
13 import errors without disabling any rules. Repository-wide lint now passes
with two pre-existing warnings in `lib/`.

## Browser verification

1. The production suite covered desktop Chromium, mobile Chromium and mobile
   WebKit: 155 passed initially, 22 platform-specific cases were skipped, and
   3 cases exposed test readiness races in the deferred rocket component.
2. The cursor-resume and workshop-entry tests now wait for that component's
   existing readiness signal before sending input. All 12 applicable focused
   reruns passed across three repetitions, resolving the three initial failures.
   These fixes change test synchronization only.
3. On the Mac's Apple M2 GPU, all four final models loaded successfully,
   both crossings and reverse travel displayed 3D, the daytime model loaded,
   and reduced motion returned to 2D. No page errors occurred.
4. All three islands were visually checked at desktop and phone sizes:
   no horizontal overflow or page errors. Flight frames were also compared
   with the original models at matching camera positions; their existing
   lightweight rendering approach is retained.
5. SHA-256 comparisons confirm that `app/` and `content/` match the start-of-task
   snapshot. The only product-component edit is the homepage fireworks interval.

Build, asset-size, image-format, model-decoding and browser-check evidence is
saved in `output/island-refinement-2026-10-21/`.

## Release scope

The release is prepared on the latest production `main` in an isolated checkout.
It includes these island assets, their Blender sources, the personal Wilson ball
and Captain America shield, the homepage fireworks interval, and test-readiness
fixes. All `app/` and `content/` files remain identical to production. Unrelated
local page and navigation edits, backups, renders and QA output are excluded.

The isolated production build passed 73 focused Playwright cases across desktop
Chromium, mobile Chromium and mobile WebKit, with 8 intentional platform skips.
Production build, standalone TypeScript and full repository lint pass. The
converted audit utilities also pass syntax and disposable-fixture checks.
