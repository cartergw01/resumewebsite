# Office plan

The Work page uses an invented office layout inspired by Carter's description of Taiwan Tech Arena. It is not an accurate floor plan. Eight rooms open existing work or personal content; there are no decorative, empty rooms.

The office is drawn like a room in a Pokémon game: a top-down tile map with chunky outlined furniture, rooms floating on the dark, and a small man who walks between them. Design preference: no AI-generated imagery. `scripts/office/draw_office.mjs` draws every pixel in code and writes hashed PNGs to `public/office/`, with their names in `lib/office-art.json`. Run it after editing the art. `lib/office-plan.ts` holds each room's box and standing spot, the furniture's footprints, and the objects that link to the copy, so moving furniture means updating the script and that file together.

Every room shows the work it stands for, using only facts already on the page. No toys or clutter. Color is used sparingly. The 886 Studios wing is natural materials with the brand's purple, `#6d35d8` from 886studios.com, kept for what carries the brand: the sign, the wall trim, the pitch, one sofa. Contrary Research uses Contrary's blue, `#184df6`, on its walls, and is the biggest room on the floor.

- 886 Studios: cream paneling, the sign, the desk, a filing cabinet, the real batch photo framed on the wall, and a small meeting corner, with 886's purple mark set into the floor. Its name is on the wall, so it isn't repeated on the floor.
- Building ikigai Launchpad: demo day in a dark hall, with a raised stage, a pitch on the screen and a podium. Kai Huang and Kevin Lin stand at the front. Max Hsieh (always in blue) and Patryk Chojecki (always in white) sit top left, Jameson Hsu and Chris Wang top right, and Jimmy Huang of PicPet (blonde buzz cut) sits next to someone from the batch, all facing the front. Ginny (dark green) and Freya (black) sit in the back row. Talking to anyone with a page on 886studios.com opens it; Ginny and Freya have none yet, so their bubbles only name them.
- Finding founders: a cafe, where most of it really happens, with big windows, an espresso machine and grinder, round tables, plants, the pipeline board between the windows, the scouting agent on a laptop, and a coffee chat with a founder in one chair.
- Community & content: a trendy bar, with dark brick, a neon 886, lit shelves of bottles, stools, pendant lights, a velvet booth, a bartender in a white tank top, and eleven people labelled Founders, who open 886's portfolio.
- Contrary Research: reading and writing, with Contrary's real mark on a bound report, in a green library with a typewriter, manuscripts, and a reading chair.
- Slug Fund Investment Group: stocks. A sector heatmap and candlesticks on the wall, the tape along it, an order book, an allocation, headlines and a yield curve on the desks, and a table of memos with Slug Fund's real mark on them. No two screens show the same thing.
- Korobra Capital & side projects: a desk with Korobra's real mark on its monitor, a desk with a computer showing code, and a writing table with an open notebook.
- About me: books, a coffee, and the game on TV.

The man has a black shirt, dark blue pants, and an undercut with a middle part. His sprite sheet has four facings and three frames.

Room names are the copy's own words, never shortened, and a unit test holds them to `content/work.md`. They are inlaid in every floor, in a shade of that floor, under the furniture and under the night, so the names belong to the building and there is no separate menu. The art is saved at six times its drawn size and scaled down smoothly, so every pixel stays the same size at any width.

The office and the story move together. With the arrow keys, or the on-screen pad on a touch screen, you walk him yourself, and he collides with walls and furniture. Clipping a corner slides him round it, so doorways don't need lining up exactly. Walk through a door and that room lights while its story types out in the text box under the office; step into the corridor and the lights go out. It shows the room's copy from `content/work.md`, all of it at once. Enter or a tap finishes the typing, and the links in the text are real. Clicking or tapping a room sends him there by the doors, and pressing a spot in the room he's already in walks him to that spot.

Objects are the copy's links: the shelves, typewriter, reading chair and stacks at Contrary Research are the five company profiles, and their report covers show the company's name as he walks up. Desk screens change the same way, using a second art layer. Stand near an object or a person, or point at one, and a bubble names it; Enter, the Open button or a click opens it. They are real links, so the Tab key reaches them too, and focus names them the same way. A unit test fails if an object links anywhere the copy does not, except for people, who open their own pages on 886's site.

The tour opens on the whole office, and zooming in lets the camera follow him. On phones the zoom is closer, and the text box sits above the controls. Arrow keys walk while the office is on screen, unless someone has tabbed to a link or the details, in which case keys behave normally.

He starts just inside the 886 Studios door with a "You are here" sign over his head, which goes once he sets off.

Light is the state. Every unlit room sits under a pane of dark, with hovered rooms half lit. Reduced motion makes clicks and typing immediate.

On the tour everything fits on one screen on the web: the same title block and hairline as every other page with "Tour the office" and "Read as a list" in its corner, the office as big as the height allows, and the story and key hints beside it, with the room's details below the fold. Zooming only changes the camera, never the layout. On phones it stacks: office, then a controller with a direction pad and an A button, then the story. Pixelify Sans is used for everything that belongs to the office. Everything else is in the site's type.

The default is the 886 Studios room, showing the current role there. All work copy remains sourced from `content/work.md` and roles from `content/portfolio.ts`.
