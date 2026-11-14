# Bookshop plan

The Writing page opens inside a small bookshop at night. You stand just inside its front corner at eye height, looking across the room: shelves on the far wall, the door, corkboard and window on the left, a beamed ceiling, and the night only through the glass. The floating islands belong to the home page (Carter's call, 2026-11-14), so the shop is a room, not a model in the sky. It's built and rendered in Blender from the same procedural kit as the islands (`scripts/blender/build_bookshop.py` imports `build_islands.py`), with no pixel art and no AI imagery.

Everything in the shop that means something is Carter's own:

- **Essays**: the eight essays stand face out on the two lit middle shelves, newest top left. Each is a cloth-bound book in that essay's own spine colours from `content/portfolio.ts`, with its real cover tipped in as a plate and its title stamped beneath.
- **Reading Lists**: the three "Best Things I Read" round-ups lie in stacks on the oak table, each topped by that list's cover, with its year on the book.
- **some of my tweets**: the corkboard between the door and the window. It opens the same tweet reader as the bird on the home page.
- **Newsletter**: the brass letter plate in the shop door, with a wire basket of post under it. It hands off to Substack exactly like the subscribe card.
- "flying Arrows", the publication's name, is in brass letters over the shelves.

The other books on the shelves have no titles, so nothing on show is invented. No clutter: a window seat and a plant. Three small brass spots on the beam light the table; pendants or a table lamp would hang in front of the essays.

## How it works on the page

The page shows the whole shop. Each area is one target, and its name shows over it on hover or focus. The buttons under the shop name all four for touch screens. Clicking an area, or its button under the shop, glides the camera into it. The glide is a CSS zoom of the still. Then a close-up fades in over it: the same camera rendered at three times the size and cropped to that area, so it lines up exactly and the covers' titles are sharp.

Inside Essays or Reading Lists, the books are the targets. Choosing one shows its date, title and subtitle under the shop, with "Read on Substack". The newest is chosen on arrival. The arrow keys, or a sideways swipe on a touch screen, step through the books. Enter on a focused book opens it, and Escape or "Whole shop" steps back out. The corkboard opens the tweet reader straight away. The door shows the subscribe form.

The essay archive and the subscribe card stay below the shop, unchanged, for reading as a list.

## Rebuilding

```bash
node scripts/blender/bookshop_content.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_bookshop.py -- --output .blender-build/bookshop-full --width 2880 --samples 96 --closeup-scale 3
node scripts/blender/export_bookshop.mjs .blender-build/bookshop-full
```

Re-run all three after a new essay is published: the shelf is built from the content, and a unit test fails when `lib/bookshop.json` no longer matches it.
