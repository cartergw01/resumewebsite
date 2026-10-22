# Blender island artwork

Three Blender scenes for the homepage islands. Geometry, materials,
lighting and a 70mm perspective camera are authored in
`scripts/blender/build_islands.py`, which also saves the scenes here as
`work.blend`, `writing.blend` and `projects.blend`. Those files are generated,
so Git ignores them; build them with `scripts/blender/pipeline.sh` (see
Rebuild). The final images are rendered from these scenes; no generated image
backplates are used.

## Art direction and references

- **Work:** a compressed Xinyi scene with Taipei 101, its adjoining mall, the
  World Trade Center courtyard, Grand Hyatt massing, Nan Shan's paired crown,
  streets, planted pedestrian plazas, sidewalks, low-rise frontage, roof equipment,
  street trees, yellow taxis, scooter parking and Xinyi/Songzhi road signs.
  Taipei 101 follows the published facts: a 25-floor pedestal tapering inward
  like a truncated pyramid; eight eight-floor modules flaring out about 7°;
  module tops near 390m, the roof near 449m and the spire tip at 508m; the
  double-stairstep re-entrant corners on every tier; one uniform blue-green
  curtain wall (an even soft teal glow at night, with gold-lit eaves, not an
  office patchwork); an ancient coin, a disc with a square hole, on each face
  where the pedestal meets the tower; and ruyi brackets about 8m tall at each
  tier's corners, curling out as small canopies. Nan Shan Plaza's retail annex
  is three large blocks offset in alternating layers. One scene unit
  represents approximately 100m.
  Connected neighborhoods occupy the western, eastern and northern shoulders.
  Narrow shopfronts have covered ground-floor arcades, recessed windows,
  different balcony arrangements, external air conditioning, parapets, water
  tanks and irregular roof extensions. Three supporting office silhouettes
  bridge the low-rise fabric and landmark towers. A planted promenade follows
  the front edge. These surrounding blocks are composed interpretations, not
  additional surveyed replicas of named buildings.
- **Writing:** a finished study-office, cut away like a doll's house: eggshell
  walls over green panelled wainscot, a chair rail, crown moulding and
  skirting, a clear window in the back wall (the render is transparent beyond
  it, so the site's own galaxy shows through; lamps are never seen by the
  camera, so nothing behind the island shows in the glass), a modern bookshelf
  (walnut shelves on a slim black frame over a charcoal back panel, each shelf
  washed by a warm LED strip, and a warm strip round the back of the case
  that lights the wall around it in a soft halo) and Carter's UC Santa Cruz degree framed on the
  side wall. Slim walnut furniture, a usable upholstered chair, a madder wool
  rug, an open notebook, an iced latte from Verve (the Santa Cruz roaster)
  in a clear glass with ice, a straw and the VERVE mark, on a cork coaster,
  a capped fountain pen beside the notebook and a task lamp. A broad green
  Japanese maple shades the Eames lounge chair and ottoman on the right-hand
  stone landing, with two warm uplights at its trunk. The reading garden
  and trellis sit outside the side wall, with clusters of glossy red Taiwanese
  wax apples (蓮霧), bell-shaped fruit and broad oval leaves. Shelf books keep their covers,
  spines and page blocks aligned as single rigid bindings.
  Two scene units represent one metre.
- **Projects:** the opposite of the study, an open, hand-built lean-to shed: a
  bare stud frame with mismatched plywood and OSB on its lower half, two
  patched sheets above and open bays to the night, no side wall, a sloping
  corrugated roof on two posts and a bare bulb on its flex. Inside, a
  steel-framed bench, tool panel, labelled storage and a 27-inch monitor. The
  workbench turns toward the visitor. Worn paving leads up to the deck. The
  lot is kept narrow (no timber stack beside the deck, a short yard past the
  court) so this wide, low scene fills its frame as fully as the taller study
  and city. It uses the same furniture scale.

### Night details

A few deliberate touches per island, not clutter: Taipei 101's eaves are uplit
gold tier by tier; Xinyi Road and the avenues carry long-exposure headlight and
tail-light streaks; Xiangshan (Elephant Mountain) rises in the south-east
corner with its lamplit stair trail; the rest of the district is built out to
a green margin with mid-rise infill, a few residential towers and pocket
parks (`densify_city`, which only builds where a ray finds bare ground). The
study's window, between linen drapes, looks out on the site's own night sky,
with an Omega Seamaster Aqua Terra-inspired wall clock above the shelves
(smooth steel bezel, navy horizontal teak dial, faceted silver hour indexes
and Ω / OMEGA branding, with live pale-green luminous arrow hands showing
Taipei time; twelve markers replace the watch's date aperture)
and a lava lamp on the top shelf, just right of the clock and clear of the
maple's branches; the
study is kept calm, lit only by warm light. The shed has festoon bulbs swagged
along its roof beam, Lakers-coloured LED strips (purple along the roof beam and
up both posts, gold along the bench's front edge), and a telescope on a tripod
in the yard; Carter's Ninebot scooter stands on its kickstand by the deck.

### Depth parallax

Every island also gets a camera-depth map rendered from its saved scene
(`scripts/blender/render_depth.py`, cropped like its still by
`scripts/blender/export_depth.mjs`; about 25–35 KB each). On fine-pointer
devices `components/ParallaxStill.tsx` redraws the still in WebGL2, shifted by
that depth as the mouse moves, with the landmark's depth as the still point so
annotations and entry surfaces stay aligned. It draws only while moving and
falls back to the plain still on touch, reduced motion, or without WebGL2.
This replaced the Writing island's transparent video loop, which cost more
frame time than any camera flight.


### Real camera flights

Between Work, Writing and Projects the camera flies in 3D. Each island has a
lightweight flight model (`scripts/blender/export_flight.py`): the saved scene
joined, its full Cycles lighting (moon or sun, lamps, emission, bounce) baked
into vertex colours, then decimated to ~45k faces and meshopt-compressed
(about 0.5–0.7 MB each as served; Taipei's daytime bake is a separate file
loaded only when day is chosen). Volume-only lamp haze remains in the lighting
bake, but its boundary geometry is excluded from the flight mesh so it cannot
become an opaque cone. Taipei's traffic drives through the flights
too (`lib/island-traffic.ts`). The browser draws them unlit (`lib/island-flight.ts`): the islands
sit apart in one space and the camera flies a curve from one island's render
camera to the next, widening the lens mid-flight so both islands share the
frame. Each end projects into the still's exact on-screen box, and the stills
cross-dissolve into the flight over the first and last 10% of the crossing, so
the hand-off is seamless. The models load after the page settles and only on
capable desktops (fine pointer, WebGL2, no data saver, ≥4 GB memory, 4G-class
connection, motion allowed); phones, or any visit until they arrive, use the
light 2D flight.

### Live details

`scripts/blender/export_life_anchors.py` projects extra points from each saved
scene through its render camera and crop into `lib/blender-islands.json`
(`life`): Taipei's traffic lanes (sampled along each avenue so traffic follows
the perspective) and Taipei 101's face, the study lamp's light cone and lava
lamp bottle, and the shed's LED ball and visible LED strips (each one's ends
and colour). `components/IslandLife.tsx` animates
them on one small canvas at ~30fps, only while the island is settled: traffic
(head/tail lights at night, cars by day), dust
drifting in the lamplight, amber wax rising and sinking in the lava lamp,
the LED ball cycling through its colours and the LED strips breathing. Every
detail sits on the thing that makes it (no glows hung in the air over bulbs,
no fireflies). It follows the depth parallax so each detail stays on its
surface.
The Omega clock uses its own SVG hands (`components/StudyClock.tsx`), projected
onto the dial plane exported as `life.clock`. `lib/study-clock.ts` reads the
current wall clock in `Asia/Taipei`, with minutes and seconds included in the
hour and minute angles. The hands and phosphorescent dial indexes retain their
lume when the room is dark. The navy face, teak edges and printed lettering
have a soft constant glow so they remain readable at the clock's small screen
size; these materials are independent of the room's light switch.
The hands update once a second even with reduced
motion, and resync when the island or
tab becomes visible. They follow the still's depth parallax. The 3D flight
uses the same proportions and time through `lib/study-clock-3d.ts`, positioned
from `lib/island-cameras.json`. No fixed main hands are baked into the stills
or flight model, so the live hands cannot overlap an old time.
Fireworks (`components/CityFireworks.tsx`) fire out of Taipei 101 at night, as
in its New Year show: sprays from the front corners of each tier in turn,
climbing the tower, then a shell off the spire; the launch points are the
`life.fireworks` points the exporter projects from the tower.

Every traffic lane sample is ray-cast from the render camera: where a building
hides the road, the lane carries 0 and cars fade out there instead of being
drawn across the building. The exporter also writes each lane's 3D run of road
into `lib/island-cameras.json` (`work.traffic`), so the camera flights carry
the same traffic, hidden by real depth.

### Taipei by day

Work also has a clear-afternoon version. A single round button at the
island's upper right offers the other time (a sun at night, a moon by day;
`components/CityTimeToggle.tsx`, remembered per visitor in localStorage), and
the stills crossfade over 1.4s. `--time day` opens the saved night
`work.blend` and only relights it (`daylight` in the build script), so both
versions share exactly the same geometry, camera and anchors: a physically
based clear sky lights the scene and is what the glass reflects, a warm sun
casts the shadows, lit glazing turns back into glass and lamps, tier lights,
traffic streaks and the night-only lantern market are removed.
`scripts/blender/export_variant.mjs` crops it with the night render's crop.

Details that read in both: every building gets its own small shift in tone
and rain streaks down its facade (`weathered`), Taipei's vertical blade shop
signs (saturated by day, lit at night), and a small neighbourhood temple with
a vermilion hall and an orange glazed swallowtail roof. Work renders at 2880px
wide with 96 samples.

Toggling the time of day is a direct 0.6s crossfade between the two stills,
with no sunrise or sunset in between.


### Room lights

The study (Writing) and the workshop (Projects) each have a light switch, a
small wall-plate button where Work has its sun and moon
(`components/RoomLightSwitch.tsx`, `lib/room-lights.ts`). Off, the room is the
same night without its lamps, bulbs and festoons: `--time dark` opens the saved
night scene and `lights_out` in the build script removes every light but the
moon rig, switches off every glowing material but screens and windows (the
LED strips, lava lamp and LED ball go dark too), and hangs one spotlight over
the room's subject (`SPOTLIGHT`): the open notebook in the study, the computer
in the workshop. `export_variant.mjs` publishes it with the
night still's crop as `darkSrc`.

One flip plays out fixture by fixture (`lib/light-switch.ts`): the lamp warms
up, the sconce snaps on, the shelf strips run along their length, the maple's
trunk uplights warm up with the desk lamp, and the lava lamp glows in last;
off reverses, and then the spotlight comes up. For that,
`--time masks` renders each of the room's light sources alone (its lamps and
glowing parts on, everything else dark; the groups are `LIGHT_SOURCES`) and
stores each one's share of every pixel's light, three sources to an RGB image;
`export_light_masks.mjs` crops them like the still and publishes them as
`lightMasks`. The page's WebGL canvas (`ParallaxStill`) eases each pixel
between the lit and dark stills at the pace of the sources lighting it, so
both ends are exactly the renders. On phones it starts when someone settles on
the room; without WebGL, or with reduced motion, the stills crossfade. The
lamp's dust, the lava lamp's wax, the LED ball and strips follow their
fixtures, and the reading lamp's pool goes out. The notebook's paper and ink
receive their light directly from the scene, with no separately dimmed page overlay.
Each room remembers its own switch per visitor. The camera flights keep their
baked, lit models.

Every lamp burns the same warm white (`WARM`, about 2700K), and the beams of
the study's lamp and sconce hang in a faint haze (`haze`), cleared with the
lights off.

### Writing's entry: the notebook lifts off the desk

The Writing island holds still while its open notebook lifts straight up off
the desk, hovers a beat, then swings up to face the visitor, comes close and
settles before the pages riffle (`lib/workshop-entry.ts`). Under it the desk is
shown without the notebook: `--time lifted` and `--time lifted-dark` render the
saved study with every `Notebook ·` object removed (lit, and with the lights
off), published as `liftedSrc` and `liftedDarkSrc` and fetched when someone
reaches for the island. A soft shadow stays on the desk where it lay; the
night closes in only once the notebook is in the air.

### Personal details

Only facts already on the site, or details Carter asked for, are used: his
Segway-Ninebot MAX scooter on its kickstand at the edge of the workshop deck,
rear tyre on the boards and front on the grass (he gets around Taipei on it;
`ninebot_scooter()` sets both tyres on whatever they stand on and leans it onto
the stand), Lakers merch (he's a fan): Kobe Bryant's gold
#24 home jersey framed in a shadow box above the bench (`kobe_jersey`: the
2009–10 back, with BRYANT in purple edged in white, white angular varsity
numbers outlined in purple, and purple side panels) and a small
purple-and-gold felt pennant, an orange basketball with a real ball's seams on
the court, a stainless Cybertruck model, and space things: a taped planet poster
and a stainless SpaceX Starship / Super Heavy display stack with a black heat
shield, ship flaps, vented hot-stage ring and booster grid fins. The navy JBL
Charge 4 sits on the top shelf beside the BLACKPINK light stick, clear of the
monitor. A pearl-white Lugia figurine stands on a navy plinth on the open
middle shelf, to the monitor's right. Its raised hand-shaped wings, blue belly,
pointed eye markings, back plates and curved tail are modelled geometry.
The stool's seat is empty. The half-court is 2.1 by 4 scene units
(previously 1 by 3.5), with a wider key, complete connected three-point markings
and the same-sized hoop. The eastern terrain lobe supports the wider pad;
planting and ground heights keep the playing surface clear. The bench holds
only what's his: the monitor, keyboard and trackpad, his iPad Pro on its Magic
Keyboard (its wallpaper a launch photo, `ipad-wallpaper-launch.jpg`), the blue
AirPods Max, and the desk lamp. The iPad has rounded glass and aluminium edges,
a forward-leaning lower support and a magnetic upper panel, leaving its bottom
edge floating above the keys. The black keyboard has staggered rows, subtle
backlit legends and a properly proportioned glass trackpad. The loose poker
chips and cards have been removed from the desktop; the chip case remains on
the lower shelf. The monitor shows TaipeiFlix, lit like a real screen. The essay
journals and project prints below are his real covers and screenshots.

Prop references:

1. [OMEGA — Seamaster Aqua Terra 150M, blue dial](https://www.omegawatches.com.hk/en-hk/watch-omega-seamaster-aqua-terra-150m-co-axial-master-chronometer-41-mm-22010412103001):
   the study's wall clock adapts the navy teak dial, smooth steel bezel,
   tapered silver indexes and Omega branding into modelled geometry, with
   live luminous hands and the Aqua Terra's broad-arrow minute hand.
2. [NBA Store — Kobe Bryant 2009–10 gold authentic jersey](https://store.nba.com/los-angeles-lakers/mens-los-angeles-lakers-kobe-bryant-mitchell-and-ness-gold-2009-10-hardwood-classics-authentic-jersey/t-81690757%2Bp-042078540173%2Bz-8-3711585841):
   back lettering, number colours, shoulder shape and side panels. Modelled
   geometry and procedural fabric; product photography is not included.
3. [SpaceX — Starship](https://www.spacex.com/vehicles/starship/design):
   two-stage silhouette, stainless exterior, tiled ship and control surfaces.
   The shelf model simplifies small flight hardware to remain readable.
4. [Apple — iPad Pro with Magic Keyboard](https://www.apple.com/newsroom/2020/04/new-magic-keyboard-for-ipad-pro-now-available-to-order-begins-arriving-next-week/):
   floating cantilever support, black keyboard deck and integrated trackpad.
   The scene keeps the 12.9-inch tablet's landscape proportions.
5. [Kaohsiung Agriculture Bureau — Wax Apple](https://agri-en.kcg.gov.tw/cp.aspx?Create=1&n=FFD95939D02E0643):
   glossy crimson skin, a broad bell shape and four sepals at the recessed
   blossom end, modelled on the study garden's fruiting branches.

6. [The Pokémon Company — Lugia](https://in.portal-pokemon.com/pokedex/0249/):
   white body, blue belly and back plates, pointed eye markings, broad
   fingered wings and long tail, interpreted as a small resin shelf figure.

### Night

The islands hang in the site's night sky (#030611), so they are lit as night
miniatures rather than daytime product shots. The world is a deep navy
ambience. A cool moon from behind on the left models every form with crisp
shadows; a blue rim lifts silhouettes off the sky; a low cool bounce models the
cliff under its overhanging lip. The story lights are warm practicals: the desk
and bench lamps pool on the work, the study window and the workshop's open bays show the
night, and Xinyi glows from its arcades, street lamps and offices. Office
windows light by floor and tenant, one tone per building, never as a random
checkerboard; Taipei 101 is one evenly glowing curtain wall, with no single
lit window. The camera uses
perspective without miniature depth-of-field blur.

The shared foundation has chipped stone faces in continuous sedimentary beds
(not per-facet mineral patches), a dark humus band under the grass lip, roots
hanging free below the edge, embedded gravel and fine grass. Its colour falls
off with depth so the underside recedes into the night. Walnut, oak and
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

The notebook has 26 thin sheets on the left and 17 on the right, gently rounded
corners, a shallow gutter, an olive cloth binding and a flat ribbon bookmark.
The paper settles into slightly different curves on each side, with a small
curl at the front right corner. Its printed ink follows the actual curved
paper mesh, so the stills, light masks, parallax and flight model share its
lighting. `scripts/blender/notebook_page.mjs` reads the opening essay's title,
date and subtitle from `content/portfolio.ts` when Blender builds the scene.
There is no flat SVG page, page-sized hover fill or touch rectangle on the book;
the invisible spread anchor still starts the Writing entry.
The rug has a soft, irregular selvedge,
visible warp, loose fringe and a crossing weave shader. Sawn board ends use ring
grain. The bench's lower shelf holds a walnut six-watch box with its glass lid
open, a cable coil and an open aluminium poker chip case (five rows of chips,
cards, a dealer button and dice), and blue AirPods Max sit on the bench by the
lamp, all at Carter's request; one drawer is open and offcuts lie beside the
timber stack. The three essay journals and the real project prints remain.

Each island has its own plan (`PLANS` in the build script): Work is a broad,
squarer district its street grid fills; Writing is a soft, rounded garden plot;
Projects is a rough, jagged lot with a yard lobe for the scooter. Every
foundation otherwise uses the same proportions: the terrain is 35% wider and deeper
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

1. Build the scenes if they are not here yet (`scripts/blender/pipeline.sh`,
   or just the night render step it runs), then open `work.blend`,
   `writing.blend`, or `projects.blend` in Blender.
2. Use camera view for the website composition. Objects have descriptive names.
3. Render with **Render → Render Image**. Transparent film is enabled.
4. Writing has a four-second loop on frames 1–48 at 12 fps. Its lamp, loose
   correspondence and plant leaves move subtly; the ground, camera
   and reading surface remain fixed. Frame 49 matches frame 1 for seamless
   repetition. Work adds an occasional pair of headlights along a projected
   foreground street. The workshop screen varies its light slightly while
   preserving the project that carries into the destination. These browser
   details pause offscreen, during entry, and when motion is reduced.

Scenes are tested with Blender 5.2.2 LTS, Cycles CPU. Intermediate renders are
ignored by Git. Save manually edited variants under another name before
rebuilding, because the script replaces the three saved scenes.

## Rebuild

One command rebuilds every website asset of an island from the build script,
in the order they depend on each other:

```sh
scripts/blender/pipeline.sh work            # or writing, projects, all
scripts/blender/pipeline.sh work --quick    # 1440px, 24 samples, for a look
```

For each island it renders the night still (2880px, 96 samples, Metal; this
also saves the `.blend`), crops it and its anchors (`prepare_islands.mjs`) and
publishes them (`export_islands.mjs`), records its camera and the crop it was
given (`export_camera.py`), renders and publishes
Work's daytime still and the rooms' lights-off stills (`export_variant.mjs`)
and light masks (`export_light_masks.mjs`), the depth map (`render_depth.py`,
`export_depth.mjs`), the live-detail anchors (`export_life_anchors.py`) and
the flight model(s) (`export_flight.py`). Then it recompresses every model with
meshopt (`compress_models.mjs`) and deletes published files nothing references.
Logs go to `.blender-build/pipeline/`; a failed step stops the run and prints
its log. Exporting a still replaces that island's manifest entry, so always
run the later steps after it, which the script does.

Builds are repeatable. The script builds the same scene every time (its
terrain noise uses `noise.noise`; Blender seeds `noise.noise_vector` randomly
at startup, which used to reshape every island on each build), and renders use
a fixed Cycles seed and the CPU denoiser. With `--cpu`, an unchanged island
re-renders byte-identically to the same fingerprinted files; on Metal (the
default, much faster) a re-render differs by at most one level in a few pixels,
invisible but enough for new file names. Rebuilding one island never changes
another's files.

Writing's old transparent video loop is no longer shown (depth parallax
replaced it). `build_islands.py --animate` still renders its 48 frames, and
`export_islands.mjs` still publishes `writing-loop.webm`/`.mov` if a render
provides them.

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

Work's entry (`lib/work-entry.ts`) is a camera push in the rendered still,
never past what the render resolves (about 2.4x on a laptop, 3x on a phone),
while Taipei 101 spells "Work" down four floors in light (`towerFloors` in
`lib/island-artwork.ts`, from the tower's eave corners). The letters then lift
off and glide onto the `/work` page's heading as the city dims behind them;
at night the tower answers the tap with a burst off its spire. The full 2880px
still is fetched on intent (hover, focus or a touch) and laid over the resized
one for the push. Reduced motion skips the approach; Escape, resize and back
cancel it. `tests/e2e/work-entry.spec.ts` checks the push, the letters landing
on the heading, content continuity and interruption.

`lib/blender-islands.json` stores the tower window's 1200×800 projection for
the still. The window is not lit or drawn anywhere: it is just a pane of
Taipei 101's even curtain wall. The night render writes it from `taipei101` in
`build_islands.py`, so it follows any change to the tower.

The Writing video pauses offscreen, in hidden tabs, and for reduced-motion or
save-data preferences. The still remains the playback fallback. The background
video, scrolling journeys and rocket effect are independent.

## Cameras

`lib/island-cameras.json` holds each island's render camera (in Three's
coordinates) and the crop its published still was given, written by
`export_camera.py`, plus Work's traffic lanes. The 3D flights between islands
(`lib/island-flight.ts`) use the camera and crop to start and end on each
still's exact framing; `export_variant.mjs` and `export_depth.mjs` use the crop
to place the day, lights-off and depth variants over the night still.

The islands used to have rotatable 3D versions (drag or swipe to look
around). They were removed on 2026-10-17: each model was 2.5-3.3 MB and
stalled the page for about a quarter of a second as it built, a sideways
swipe competed with scrolling on phones, the real-time lighting only
approximated the Cycles stills, and every scene change had to be re-exported
to match.
