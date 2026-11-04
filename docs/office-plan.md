# Office plan

The Work page uses an invented office layout inspired by Carter's description of Taiwan Tech Arena. It is not an accurate floor plan. Eight stations open existing work or personal content; there are no decorative, empty rooms.

Design preference: no AI-generated imagery. The office is drawn directly in SVG with cream walls, wood desks, muted green furniture, plants, and small shadows. It is a cutaway at night, and it is just an office: no island or skyline around it. The plan in `lib/office-plan.ts` stays the source of truth for seats, routes, and collisions; `officeProject` turns plan coordinates and a height into the drawing. Artwork lives in `OfficePlan.tsx`. There are no labels drawn over the art. Each floor is a pointer and touch target clipped to its shape; native buttons in the room directory carry the names, focus states and keyboard use.

The props say what happened in each station, using only facts already on the page: the Accelerator whiteboard, the founder pipeline pinned above the booths with fewer notes in each column, string lights and a mic for community events, Contrary's shelves and stacks of deep dives, a UC Santa Cruz pennant and banana slug for Slug Fund, Korobra's chart and the moped from the traffic game for side work, and poker chips, a basketball and a bike for About me.

Light is the interface. The building sits under a night layer, and the selected station is a soft hole in it. Selecting a station opens its details immediately while the lights behind go out; a small figure stands, carries a glow along the studio aisle or corridor, and the new station lights up as it arrives. Hovering a floor or a name, or focusing a name, raises that station's light halfway and links the two. A room's name is lettered on its floor and shows only when the room is lit or hovered. Reduced motion makes movement and lighting immediate.

The directory names all eight stations in two groups, 886 Studios first. A Next link at the end of each room's details walks them in order, and arrow keys do the same from the directory. There is no modal: on phones the directory is one scrolling row under the office, with the details below it. The List view preserves the complete work history and the original batch-photo position.

On desktop, the story column holds the heading, directory and details, and the office stays pinned beside it, sized to fit the viewport. One open 886 Studios room contains four distinct stations: Venture Associate, Accelerator, Finding founders, and Community. Contrary and Slug Fund Investment Group have rooms in the right wing. Side work and About me share the lower personal space.

The default is the open office, showing the current role at 886 Studios. All work copy remains sourced from `content/work.md` and roles from `content/portfolio.ts`. The island transition from the homepage copies a hidden preview of this page, so `lib/work-entry.ts` renames the drawing's gradients and mask in that copy.
