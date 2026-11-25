# Writing board

The Writing page opens on a corkboard of Carter's essays (`components/EssayBoard.tsx`), pinned up like photos, newest first. Each card has the essay's real cover, its date and title. Under the heading, it's the first thing on the page: four across on desktop, two on a phone.

Clicking a card lifts it off the board into a reading sheet: the cover, date, title and subtitle, then how the essay begins, fading out into "Keep reading on Substack". Previous and Next (or the arrow keys, or a swipe) turn to the neighbouring essays without closing. Escape, the × or a tap outside puts it back.

The openings are the essays' own first paragraphs, saved from the flying Arrows feed into `content/essay-openings.json` by `node scripts/essay-openings.mjs`. Run it after publishing; a unit test fails until a new essay has its opening.

Two wooden tabs on the top edge of the board's frame pick how to read the page, like folder tabs: **Bulletin** (the cork with the essays pinned up, the default) and **Read as a list** (the archive of essays and reading lists, as ink on a sheet of paper in the same frame, with a red notebook margin line). Only one shows at a time (`components/WritingViews.tsx`, which owns the frame). Carter picked the frame tabs on 2026-11-25 over a pushpin hopping between two names on tape and a wooden slider. The subscribe card sits below either.

The tweet reader the mailbox opens has round Previous and Next arrows outside the card, one on each side, with Shuffle beside the close button (2026-11-25).

In the board's bottom corner is a mailbox labelled "some of my tweets". Opening it brings up the same tweet reader as the Writing island (`components/ThoughtCollection.tsx`); the tweets aren't pinned on the board themselves. Carter picked the mailbox over handwritten postcards on the board (2026-11-25).

History: before this, the page was a Blender-rendered bookshop you walked along (branch `writing-bookshop`, commits up to df5ee92). Carter found it too much and asked for this simpler board (2026-11-24).
