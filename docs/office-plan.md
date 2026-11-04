# Office plan

The Work page uses an invented office layout inspired by Carter's description of Taiwan Tech Arena. It is not an accurate floor plan. Eight rooms open existing work or personal content; there are no decorative, empty rooms.

The office is drawn like a room in a Pokémon game: a top-down tile map with chunky outlined furniture, rooms floating on the dark, and a small man who walks between them. Design preference: no AI-generated imagery. `scripts/office/draw_office.mjs` draws every pixel in code and writes hashed PNGs to `public/office/`, with their names in `lib/office-art.json`. Run it after editing the art. `lib/office-plan.ts` holds each room's box and standing spot, the furniture's footprints, and the objects that link to the copy, so moving furniture means updating the script and that file together.

Every room shows the work it stands for, using only facts already on the page. No toys or clutter. Color is used sparingly. The 886 Studios wing is natural materials with the brand's purple, `#6d35d8` from 886studios.com, kept for what carries the brand: the sign, the wall trim, the pitch, one sofa. Contrary Research uses Contrary's blue, `#184df6`, on its walls, and is the biggest room on the floor.

- 886 Studios: the sign, the desk, and a filing cabinet. Its name is on the wall, so it isn't repeated on the floor.
- Building ikigai Launchpad: demo day, with a pitch on the screen, a podium, and rows of founders' chairs.
- Finding founders: the pipeline board with fewer notes in each column, and the agent scanning on a green terminal.
- Community & content: the coffee bar, the sofa, the newsletter, and people. Kai and Kevin, of Guitar Hero and Twitch, are talking by the bar with founders around them; talking to any of them opens 886's portfolio.
- Contrary Research: reading and writing, in a green library with a typewriter, manuscripts, and a reading chair.
- Slug Fund Investment Group: stocks. A sector heatmap and candlesticks on the wall, the tape along it, an order book, an allocation, headlines and a yield curve on the desks, and the memo table. No two screens show the same thing.
- Korobra Capital & side projects: the fund's chart, code on screen, and shelves of notebooks.
- About me: books, a coffee, and the game on TV.

The man has a black shirt, dark blue pants, and an undercut with a middle part. His sprite sheet has four facings and three frames.

Room names are the copy's own words, never shortened, and a unit test holds them to `content/work.md`. They are inlaid in every floor, in a shade of that floor, under the furniture and under the night, so the names belong to the building and there is no separate menu. The art is saved at six times its drawn size and scaled down smoothly, so every pixel stays the same size at any width.

The office and the story move together. With the arrow keys you walk him yourself, and he collides with walls and furniture. Clipping a corner slides him round it, so doorways don't need lining up exactly. Walk through a door and that room lights while its story takes over the details beside it; step back into the corridor and the lights go out. Pressing an arrow key scrolls nothing while the office is on screen. Clicking or tapping a room, or the Next link after its details, sends him there by the doors.

Objects in a room are the same links as the words beside it: the shelves, typewriter, reading chair and stacks at Contrary Research are the five company profiles, the screen is ikigai Launchpad, the poster is the newsletter. Stand near one, or point at it, and a bubble over his head names it; Enter or a click opens it. A unit test fails if an object links anywhere the copy does not. Touch screens leave these out, since the same links are in the story below the office.

Light is the state. Every unlit room sits under a pane of dark, with hovered rooms half lit. Reduced motion makes clicks immediate. The List view preserves the complete work history and the original batch-photo position.

The default is the 886 Studios room, showing the current role there. All work copy remains sourced from `content/work.md` and roles from `content/portfolio.ts`.
