# Bookshop plan

The Writing page is a bookshop you walk along. You see one long, narrow shop straight on, like a doll's house with its front taken off: no 3D angle, just a slight downward tilt to show the floor. Scrolling the page walks you along it.

Carter's direction (2026-11-14):
- Floating islands belong to the home page.
- The bookshop shouldn't be seen from an angle.
- It has to be an experience, not a picture with hotspots.

## The shelf is a timeline

Walking left to right takes you through Carter's writing in the order he wrote it:

1. **The door.** Its brass letter plate, with a wire basket of post under it, is the newsletter. Taking a letter from it shows the subscribe form, handing off to Substack exactly like the subscribe card. The shop window beside it has "flying Arrows" in gilt on the glass, and through the glass is the page's own night sky.
2. **A bay of shelves for each year.** Each bay has a brass year plate on top. That year's essays stand face out on the lit eye-level shelf, oldest first. Each is a cloth-bound book in its own spine colours from `content/portfolio.ts`, with its real cover tipped in and its title stamped beneath.
3. **Each year's reading list.** "The Best Things I Read in 2023", and the later lists, are each propped on a low table in front of that year's bay. The tables stand nearer than the shelves.
4. **The corkboard of notes.** It's under a brass picture light at the far end, by a window seat, and it opens the same tweet reader as the bird on the home page.

The other books have no titles, so nothing on show is invented.

## What makes it an experience

- **Walking.** The shop is pinned under the navigation while the page scrolls past it, so a wheel, trackpad, swipe or space bar walks you along. The arrow keys step to the next or previous thing on the shelf, and Tab walks you to each one in turn.
- **Depth.** The tables and plants in front move a little faster than the wall (`NEAR` in `components/Bookshop.tsx`). That's why they're rendered as a separate layer, with their own floor shadows. Each one lines up with its bay when you stand in front of it. The sky through the windows doesn't move at all.
- **Light.** The shop is brightest where you stand and dims towards the edges.
- **Reaching for things.** Whatever is in front of you leans out of the shelf toward you, and is named under the shop, with its date, beside a ruler of the years showing where you are.
- **Taking a book down.** Tapping a book, Enter, or "Open" takes it down: it flies from the shelf to the middle of the screen, and its cover swings open. The inside of the cover becomes the left page, showing the essay's art. The right page has the date, title, subtitle and "Read on Substack". On a phone, the cover swings away and the page stays centred. Escape, the × or a tap outside puts it back.

The essay archive and the subscribe card stay below the shop for reading as a list.

## Building it

```bash
node scripts/blender/bookshop_content.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_bookshop.py -- --output .blender-build/bookshop --ppu 260 --samples 48
node scripts/blender/export_bookshop.mjs .blender-build/bookshop
```

`build_bookshop.py` uses the islands' procedural kit from `build_islands.py`, with no pixel art or AI imagery. It renders two passes from one level orthographic camera:

- **The room**, with the furniture left out.
- **The furniture alone**, with the room held out and the floor only catching the furniture's shadows.

The exporter cuts the room into tiles, cuts out each piece of furniture and each book, and writes `lib/bookshop.json`. Re-run all three after a new essay is published. The shelves are built from the content, and a unit test fails when they no longer match it, or when an essay stands outside its year's bay.
