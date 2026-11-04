# Office plan

The Work page uses an invented office layout inspired by Carter's description of Taiwan Tech Arena. It is not an accurate floor plan. Eight stations open existing work or personal content; there are no decorative, empty rooms.

Design preference: no AI-generated imagery. The office is drawn directly in SVG with cream walls, wood desks, muted green furniture, plants, and small shadows. The footprint is asymmetric. Native HTML buttons provide labels, focus states and touch targets. The surrounding page uses the shared fonts, spacing, colors, and divider tokens. Artwork lives in `OfficePlan.tsx`; labels, seating positions, and walking routes live in `lib/office-plan.ts`.

Selecting a station opens its work details immediately. A small figure seen from above leaves its seat, walks along the studio aisle or corridor, turns, and sits at the selected station. Hover, focus and selection light desk lamps, wake the booth screens, or subtly move papers and coffee steam. Keyboard users can Tab between stations and select with Enter or Space. Reduced motion makes movement and object responses immediate. The List view preserves the complete work history and the original batch-photo position.

On phones, details open in a compact modal sheet while the office stays at the same scroll position. Close, Escape, or a tap outside returns focus to the selected space. Longer details scroll inside the sheet. Desktop details remain beside the plan. A single action switches between the office and the complete list.

One open 886 Studios room contains four distinct stations: Venture Associate, Accelerator, Finding founders, and Community. Contrary and Slug Fund Investment Group have rooms in the right wing. Side work and About me share the lower personal space. Labels have reserved clear space below furniture; the selected label gains a dot and underline. The office occupies roughly two-thirds of the desktop layout. The compact details column omits the repeated 886 navigation links, which remain useful inside the mobile sheet. Work, Writing, and Projects share the same compact header spacing. Mobile Work uses the shared contact footer without repeating the invitation.

The default is the open office, showing the current role at 886 Studios. Other spaces cover accelerator work, finding founders, community, Contrary Research, Slug Fund Investment Group, side projects, and personal interests. All work copy remains sourced from `content/work.md` and roles from `content/portfolio.ts`.
