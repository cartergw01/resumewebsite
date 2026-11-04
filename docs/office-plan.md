# Office plan

The Work page uses an invented office layout inspired by Carter's description of Taiwan Tech Arena. It is not an accurate floor plan. Eight rooms open existing work or personal content; there are no decorative, empty rooms.

The office is drawn like a room in a Pokémon game: a top-down tile map with chunky outlined furniture, rooms floating on the dark, and a small man who walks between them. Design preference: no AI-generated imagery. `scripts/office/draw_office.mjs` draws every pixel in code and writes hashed PNGs to `public/office/`, with their names in `lib/office-art.json`. Run it after editing the art. `lib/office-plan.ts` holds each room's box, door and standing spot, and `tests/unit/office-plan.test.mjs` keeps an independent list of furniture bounds, so moving furniture means updating all three.

Every room shows the work it stands for, using only facts already on the page. No toys or clutter.

- Venture Associate: the 886 sign, the desk, and a filing cabinet.
- Accelerator: demo day, with a pitch on the screen, a podium, and rows of founders' chairs.
- Finding founders: the pipeline board with fewer notes in each column, and the agent scanning on a green terminal.
- Community: the residency's coffee bar and sofa, with a newsletter on the wall.
- Contrary: reading and writing, in a green library with a typewriter, manuscripts, and a reading chair.
- Slug Fund Investment Group: stocks, with candlesticks and an index on the wall over a floor of trading desks.
- Side work: the fund's chart, code on screen, and shelves of notebooks.
- About me: books, a coffee, and the game on TV.

The man has a black shirt, dark blue pants, and an undercut with a middle part. His sprite sheet has four facings and three frames.

Light is the interface. Every unlit room sits under a pane of dark, and the selected room is bright. Selecting a room opens its details immediately while the lights behind go out; he walks out by the door and along the corridor, and the new room lights up as he arrives, its name lettered on the floor. Hovering a floor or a menu name raises that room's light halfway. Reduced motion makes movement and lighting immediate.

The menu is a game menu window with a pointer cursor, set in Pixelify Sans: 886's four rooms in the left column, the rest in the right. Arrow keys move the cursor. Details stay in the site's own type so they remain comfortable to read. A Next link at the end of each room's details walks the rooms in order. There is no modal: on phones the menu sits under the office with the details below it. The List view preserves the complete work history and the original batch-photo position.

The default is the Venture Associate room, showing the current role at 886 Studios. All work copy remains sourced from `content/work.md` and roles from `content/portfolio.ts`.
