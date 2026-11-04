# Office plan

The Work page uses an invented office layout inspired by Carter's description of Taiwan Tech Arena. It is not an accurate floor plan. Eight stations open existing work or personal content; there are no decorative, empty rooms.

Design preference: no AI-generated imagery. The office is drawn directly in SVG with cream walls, wood desks, muted green furniture, plants, and small shadows. It is a cutaway at night, floating on its own island of grass and stone with Taipei 101 across the city, so it belongs to the same world as the homepage. The plan in `lib/office-plan.ts` stays the source of truth for seats, routes, and collisions; `officeProject` turns plan coordinates and a height into the drawing. Artwork lives in `OfficePlan.tsx`. Native HTML buttons provide labels, focus states and touch targets, and each button's hit area is clipped to its station's floor.

The props say what happened in each station, using only facts already on the page: the Accelerator whiteboard, the founder pipeline pinned above the booths with fewer notes in each column, string lights and a mic for community events, Contrary's shelves and stacks of deep dives, a UC Santa Cruz pennant and banana slug for Slug Fund, Korobra's chart and the moped from the traffic game for side work, and poker chips, a basketball and a bike for About me.

Light is the interface. The building sits under a night layer, and the selected station is a soft hole in it. Selecting a station opens its details immediately while the lights behind go out; a small figure stands, carries a glow along the studio aisle or corridor, and the new station lights up as it arrives. Hover and keyboard focus raise a station's light halfway. Reduced motion makes movement and lighting immediate, and removes the island's slow float.

Previous and Next buttons walk all eight stations in order, with a track showing where you are, so nobody has to hunt for the next room. Arrow keys do the same from any station. There is no modal: on phones the office stays on screen with the controls and details below it, so details and the figure can be seen together. The List view preserves the complete work history and the original batch-photo position.

On desktop, the story column holds the heading, controls and details, and the office stays pinned beside it, sized to fit the viewport. One open 886 Studios room contains four distinct stations: Venture Associate, Accelerator, Finding founders, and Community. Contrary and Slug Fund Investment Group have rooms in the right wing. Side work and About me share the lower personal space.

The default is the open office, showing the current role at 886 Studios. All work copy remains sourced from `content/work.md` and roles from `content/portfolio.ts`. The island transition from the homepage copies a hidden preview of this page, so `lib/work-entry.ts` renames the drawing's gradients and mask in that copy.
