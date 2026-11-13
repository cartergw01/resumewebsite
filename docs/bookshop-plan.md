# Bookshop plan

The Writing page opens on a small bookshop at night, floating in the page's sky like the islands on the home page. It's built and rendered in Blender from the same procedural kit as the islands (`scripts/blender/build_bookshop.py` imports `build_islands.py`). It has no pixel art and no AI imagery. The Office on /work is the pixel-art place; the bookshop deliberately looks like the home page instead.

Everything in the shop that means something is Carter's own:

- **Essays**: the eight essays stand face out on the two lit middle shelves, newest top left. Each is a cloth-bound book in that essay's own spine colours from `content/portfolio.ts`, with its real cover tipped in as a plate and its title stamped beneath.
- **Reading Lists**: the three "Best Things I Read" round-ups lie in stacks on the oak table, each topped by that list's cover, with its year on the book.
- **some of my tweets**: the corkboard between the door and the window. It opens the same tweet reader as the bird on the home page.
- **Newsletter**: the brass letter plate in the shop door, with a wire basket of post under it. It hands off to Substack exactly like the subscribe card.
- "flying Arrows", the publication's name, is in brass letters over the shelves.

The other books on the shelves have no titles, so nothing on show is invented. No clutter: a window seat, a reading chair with its lamp, two plants.

## How it works on the page

The page shows the whole shop. Each area is one target, and its name shows over it on hover or focus. The buttons under the shop name all four for touch screens, where phones also frame the building a little closer. Clicking an area, or its button under the shop, glides the camera into it. The glide is a CSS zoom of the still. Then a close-up fades in over it: the same camera rendered at three times the size and cropped to that area, so it lines up exactly and the covers' titles are sharp.

Inside Essays or Reading Lists, the books are the targets. Choosing one shows its date, title and subtitle under the shop, with "Read on Substack". The newest is chosen on arrival. The arrow keys, or a sideways swipe on a touch screen, step through the books. Enter on a focused book opens it, and Escape or "Whole shop" steps back out. The corkboard opens the tweet reader straight away. The door shows the subscribe form.

The essay archive and the subscribe card stay below the shop, unchanged, for reading as a list.

## Rebuilding

```bash
node scripts/blender/bookshop_content.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_bookshop.py -- --output .blender-build/bookshop-full --width 2880 --samples 96 --closeup-scale 3
node scripts/blender/export_bookshop.mjs .blender-build/bookshop-full
```

Re-run all three after a new essay is published: the shelf is built from the content, and a unit test fails when `lib/bookshop.json` no longer matches it.
