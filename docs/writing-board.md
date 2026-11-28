# Writing board

The Writing page opens on a corkboard of Carter's essays (`components/EssayBoard.tsx`), pinned up like photos, newest first. Each card has the essay's real cover, its date and title. Under the heading, it's the first thing on the page: four across on desktop, two on a phone.

Clicking a card lifts it off the board into a reading sheet that looks like the card, bigger: a pin on top, the cover inset in a paper border, then the date, title and subtitle and how the essay begins, fading out into "Keep reading on Substack". A row above the sheet shows where you are ("3 of 8") and the ×. Thin chevrons either side (or the arrow keys, or a swipe) turn to the neighbouring essays without closing; on wide screens the neighbouring titles sit under them, and on phones they move up beside the count. Escape, the × or a tap outside puts it back (2026-11-27).

The openings are the essays' own first paragraphs, saved from the flying Arrows feed into `content/essay-openings.json` by `node scripts/essay-openings.mjs`. Run it after publishing; a unit test fails until a new essay has its opening.

Two wooden tabs on the top edge of the board's frame pick how to read the page, like folder tabs: **Bulletin** (the cork with the essays pinned up, the default) and **Read as a list** (the archive of essays and reading lists, as ink on a sheet of paper in the same frame, with a red notebook margin line; on phones each row's "View →" sits at its bottom, under the subtitle). Only one shows at a time (`components/WritingViews.tsx`, which owns the frame). Carter picked the frame tabs on 2026-11-25 over a pushpin hopping between two names on tape and a wooden slider. The subscribe card sits below either.

The tweet reader the sticky notes open has Previous and Next outside the card, one on each side, with Shuffle beside the close button (2026-11-25). They were round buttons at first; Carter wanted them simpler, so since 2026-11-27 they are bare thin chevrons, the same as on the essay sheet.

Under the essays, in the cork's bottom-right corner, is a pinned pad of yellow sticky notes labelled "some of my tweets" (a strip across the bottom of the cork on phones). Carter first had it in the top-right corner, then asked for it at the bottom (2026-11-26). Opening it brings up the same tweet reader as the Writing island (`components/ThoughtCollection.tsx`); the tweets aren't pinned on the board themselves. It started as a mailbox at the bottom of the board, which Carter found random and easy to miss; he picked the sticky notes over moving the mailbox onto the frame or a third tab (2026-11-26). Before that he picked the mailbox over handwritten postcards (2026-11-25).

History: before this, the page was a Blender-rendered bookshop you walked along (branch `writing-bookshop`, commits up to df5ee92). Carter found it too much and asked for this simpler board (2026-11-24).
