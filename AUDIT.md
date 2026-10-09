# /2.0 design audit

Branch: `design-audit` (never merged, never deployed to production). Baseline captures live in `audit/before/`, post-fix captures in `audit/after/`.

How this was measured: production build (`next build && next start`) on localhost, driven with Playwright (Chromium + WebKit) at 375 / 768 / 1280 / 1920 px, plus 3440 ultra-wide, 640 px @2x (≈200% zoom on a laptop), 844×390 landscape phone, reduced motion, JS disabled, and blocked video. Lighthouse 12 mobile + desktop, axe-core 4 at all four widths, a 25-stop keyboard Tab walk, Slow-4G + 4× CPU throttled loads at 1/3/6 s, and a timing harness that clicks into each island and measures click → destination heading.

The site is dark-only (`<html data-theme="dark">`, no light theme exists), so there is no light-mode capture. That is a deliberate brand choice, not a finding.

<!-- SESSION SUMMARY is inserted above this line at the end of the session -->

## Top 5 (before fixes)

1. **A-01 · Every path into content is a 2.2–2.7 s cinematic.** Clicking an island, a stop heading, or even the inline text link "writing" runs the full fly-in before the destination renders. A founder giving the site 30 seconds spends ~10% of it watching a camera move. Cut it to ≈1 s and let plain text links be plain links.
2. **A-02 · On desktop, the landing view has no visible way in.** The three islands are unlabeled until hovered, the inline links ("886 Studios", "writing", "building") are indistinguishable from body text, and the only labeled nav ("Work · Writing · Projects") moves the camera instead of opening anything.
3. **A-03 · A Substack reader can't read anything in one click.** No essay title appears anywhere legible on /2.0; the latest essay is rendered in perspective on a tiny notebook. Shortest path today: click → 2.3 s flight → /writing → click → Substack.
4. **A-04 · Link previews are blank.** No `og:image`, `twitter:card=summary`, description "Carter Wang's personal website." Slack literally unfurls "Carter Wang / Carter Wang / Carter Wang's personal website." The first impression for every shared link is a grey box.
5. **A-05 · Scroll is hijacked harder than it needs to be.** One 60 px wheel tick flings the page 781 px over ~1 s; a keyboard ArrowDown animates for 923 ms. The stops are the design, so snapping stays, but the glide is twice as long as it should be.

## Findings

Format: `[ID] [priority] Category: Issue` → principle violated → evidence → why it matters → fix. Status is tracked at the end of each entry.

### P0

**[A-01] [P0] Interaction: every route into content is gated by a 2.2–2.7 s entry animation**
- Principle: Doherty threshold (respond within 400 ms); "the signature element should feel like a reward, not a gate" (Paco/Lee); Jakob's law (a text link should behave like a link).
- Evidence: `lib/island-entry-motion.ts:4` `ISLAND_ENTRY_DURATION = 2800`; `IslandLink.tsx:100-160` only calls `router.push` after the 2050 ms approach finishes. Measured (timing harness, prod build): intro → /work 2242 ms; #writing stop → /writing 2491 ms (heading visible 2710 ms); **inline text link "writing" → /writing 2140 ms**, because `IslandScrollTransport.tsx:401-422` re-dispatches clicks on `[data-enter-island]` text links to the island. Same numbers on a 390 px phone.
- Why it matters: audience #1 gives the site ~30 s. Three seconds of mandatory cinema per click, on every click, turns the signature into a toll booth. The first time it's a delight; the second time it's a wait.
- Fix: compress the whole entry to ≈1.1 s (approach ≈0.8 s, arrival ≈0.3 s), keeping the choreography's proportions; make the hero's inline text links ("writing", "building") navigate immediately with no flight. Islands and stop headings keep the (shorter) flight — that's where the reward belongs.
- Status: **Fixed.** Entry 2800 → 1150 ms (approach 800, arrival 350), all choreography scales from the shared constants. Measured click → destination heading: intro→/work 2242 → 975 ms; #writing→/writing 2710 → 1383 ms; hero text link "writing" 2140 → 94 ms (no flight). Frames checked mid-entry for Work/Writing/Projects at 1280: city push, notebook opening and card fan still read correctly. Alternative rejected: keep the flight on text links but at 1 s — a text link that animates is still a surprise.

**[A-02] [P0] Navigation & wayfinding: desktop landing view has no visible, labeled way into any page**
- Principle: Recognition over recall (Nielsen); "Make anything that looks interactive interactive / anything interactive look interactive" (Vercel guidelines); Jakob's law.
- Evidence: `IslandHome.module.css:512-515` hides `.overviewLabel` for `(hover: hover) and (pointer: fine)` — so mobile shows "Work / Writing / Projects" under each island (`audit/before/chromium-375-intro.jpg`) but desktop shows three unlabeled dioramas (`chromium-1280-intro.jpg`, `chromium-1920-intro.jpg`). The only labels on screen are the bottom tabs, which are `<button>`s that move the camera (`IslandScrollTransport.tsx:716-727`), and their left-to-right order (Work, Writing, Projects) doesn't match the islands' positions (Work top-left, Projects top-right, Writing bottom-centre). Inline links in the hero have no underline: Tailwind preflight sets `a { text-decoration: inherit }`, so `.description a { text-decoration-color: … }` (`IslandHome.module.css:89`) styles an underline that never renders; axe flags `link-in-text-block` ×3 as needs-review.
- Why it matters: a laptop visitor has to hover random 3D art to learn what it is. The one labeled row of words doesn't open anything. That's the exact moment Jakob's law charges its fee.
- Fix: always show the italic island labels (they already exist and look good on mobile); give hero text links a visible resting underline. Keep the cursor tooltip as an enhancement.
- Status: **Fixed.** Island labels now show at every width and sit under each island's contained art (they used to be hidden for mouse users); hero text links have a resting 1 px underline at 40% paper, brightening on hover/focus. The scene tabs stay camera controls — see A-22.

**[A-04] [P0] Metadata & sharing: link previews are empty and say the name three times**
- Principle: Vercel guidelines (Content: accurate titles/descriptions); first impression for audience #1, who mostly arrive via a shared link.
- Evidence: `lib/seo.ts:12-14` description "Carter Wang's personal website."; `buildMetadata` emits `twitter:card=summary` and no `og:image` (removed in `53930d7`). `audit/before/link-previews.jpg`: X shows a grey placeholder square, LinkedIn shows a no-image card, Slack renders "Carter Wang / Carter Wang / Carter Wang's personal website.", iMessage falls back to the favicon tile.
- Why it matters: most founders/investors meet the site as an unfurl in a DM, Slack, or LinkedIn message before they click. Right now that unfurl carries zero information and looks broken.
- Fix: description built from Carter's own hero sentence; a 1200×630 `og:image` that is an actual capture of the /2.0 opening view (the islands + name — real, not a generated poster); `summary_large_image`. **Judgment call:** this reverses commit `53930d7` ("Remove social sharing preview image"). The removed image was a generated nebula gradient with text; this one is the real site. If you still want no image, revert the single commit and keep the description change.
- Status: **Fixed.** `twitter:card=summary_large_image`, `og:image` = real capture of the opening view (`public/og-image.jpg`, 2400×1260, 189 KB), description from the hero sentence. Before/after mocks: `audit/before/link-previews.jpg` → `audit/after/link-previews.jpg`. The absolute og:image URL only resolves once deployed.

### P1

**[A-03] [P1] Information architecture: no essay is one click from landing**
- Principle: "A visitor should be able to read something of mine within one click of landing" (Lee Robinson / Brian Lovin); content-first.
- Evidence: the only essay surfaced on /2.0 is drawn onto the notebook in perspective (`WritingIsland.tsx`, `EssayLeaf`), illegible at every width (`chromium-1280-writing.jpg`). The Writing stop's copy links to the Substack home, not an essay.
- Why it matters: audience #2 came from Substack and wants more of the writing; audience #1 wants proof of thinking. Both hit a dead end of decorative text.
- Fix: one quiet line under the hero copy linking straight to the latest essay (title from `content/portfolio.ts`, href to the Substack post). Alternative considered: put it only on the Writing stop — rejected because most 30-second visitors never leave the opening view.
- Status: **Fixed.** A quiet "latest essay" line under the hero links directly to the newest Substack post (display italic, real underline, 44 px-tall hit area). Verified at 375×667 (iPhone SE): still fits above the islands. Follow-up: the e2e suite caught the lowest island label crowding "scroll down" at 320×568; on short phones the line is now compact and the Projects island sits 4% higher (label clears the prompt by 13 px).

**[A-05] [P1] Interaction & motion: scroll glide is too long; keyboard travel animates for ~1 s**
- Principle: Rauno/Emil — UI motion under ~300 ms, keyboard-triggered and frequent actions shouldn't animate; "never fight native scroll".
- Evidence: `IslandScrollTransport.tsx:363` glide length `min(1250, 600 + Δstops·300)` ms with a cubic in-out. Measured: one 60 px wheel tick → page travels 781 px and settles after 981 ms; ArrowDown settles after 923 ms (1280 and 390 px).
- Why it matters: the stops are the design (the camera should never rest between islands), so snapping stays — that's the tradeoff, and the islands win it. But a full second per step makes the whole site feel heavy, and keyboard users pay it on every keypress.
- Fix: shorten the glide (≈450 ms + 180 ms per stop, cap 900 ms); keyboard steps use the short end.
- Status: **Fixed.** Glide `min(1250, 600 + 300/stop)` → `min(900, 450 + 180/stop)` ms. Measured settle after one wheel tick 981 → 709 ms; ArrowDown 923 → 741 ms (1280) and 950 → 682 ms (390). Snapping kept on purpose. Alternative rejected: instant jumps for keyboard ("keyboard actions shouldn't animate") — here the crossing *is* the content, and an instant cut between islands loses the sense of place; reduced-motion users already get instant jumps.

**[A-06] [P1] Accessibility: weak focus indicators on the main targets**
- Principle: Vercel guidelines (visible, unobscured focus ring); WCAG 2.4.7/2.4.11.
- Evidence: tab walk (`audit/before/taborder-1280.json`): island links get `outline: 1px solid rgba(235,208,172,.6)` (`IslandHome.module.css:221,249`), scene tabs `1px rgba(242,215,167,.73)` (`:302`), while everything else uses the global 2px paper ring. A 1 px 60%-alpha hairline over a busy render is effectively invisible.
- Fix: island links and scene tabs use the global 2 px ring.
- Status: **Fixed.** Islands, stop islands and scene tabs use the same 2 px paper ring as every other control. The opening-view ring is drawn on `::after` so it wraps the island *and* its label (a plain outline cut through the label once A-02 moved it under the art). Checked at 1280 and 375.

**[A-07] [P1] Accessibility: "scroll down" button's accessible name doesn't contain its visible label**
- Principle: WCAG 2.5.3 Label in Name; axe `label-content-name-mismatch` (serious) at all four widths; Lighthouse a11y fail.
- Evidence: `IslandScrollTransport.tsx:286-288,686` visible "scroll down", name "Scroll to the Work island".
- Fix: names start with the visible text ("Scroll down to the Work island", "Back to the start").
- Status: **Fixed.** Names now begin with the visible words: "Scroll down to the Work island", "Scroll down to the end", "Back to the start". Verified with axe in the after pass.

**[A-08] [P1] Accessibility / copy: island link names are lowercase prompts with a redundant suffix**
- Principle: Label in Name; consistent nouns.
- Evidence: accessibility tree (`audit/before/aria-1280.yaml`): "learn about my work. Enter Work island", "see what i’ve built. Enter Projects island". The visible label on mobile is "Work"; the name puts it at the end.
- Fix: `"Work — learn about my work"` pattern (visible label first, prompt second, no "Enter … island").
- Status: **Fixed.** Island links are named "Work, learn about my work" / "Writing, read my writing" / "Projects, see what i’ve built" — the visible label first. e2e selectors updated to match (`/^Work,/` etc.).

**[A-09] [P1] Navigation: the orbit hint replaces the island's only call to action**
- Principle: affordances must be visible (recognition over recall); the 3D orbit should be a reward, not compete with the way in.
- Evidence: `IslandHome.module.css:149-152` + `IslandOrbit.tsx:57-70`: 1.4 s after arriving at an island, "learn about my work" is swapped for "drag to look around" for 3.5 s (`edge-zoom200-work.jpg`, `edge-reduced-work.jpg`). The arrow pointing at the landmark is hidden too. A first-time visitor's first look at the CTA is an instruction for an optional toy.
- Fix: keep the CTA and its arrow; show the orbit hint as a smaller second line beneath it.
- Status: **Fixed.** The orbit hint is now a smaller, dimmer second line under the prompt ("learn about my work / drag to look around"); the prompt and its arrow stay visible. Only the book's arrow rests during the 3.5 s hint, because it would cross the second line. Checked Work at 1280 and Writing at 375.

**[A-10] [P1] Visual design: header and scene don't share edges on wide screens**
- Principle: Refactoring UI / Linear — align everything to one grid; Vercel "verify on ultra-wide".
- Evidence: `.site-nav` is capped at 1120 px and centred (`globals.css:444-456`) while scenes and the scene tabs run to `--page-x` from the viewport edge. At 1920 the social icons end at x≈1510 while the tabs end at x≈1790 (`chromium-1920-intro.jpg`); at 3440 the icons float in the middle of the sky (`edge-ultrawide-3440.jpg`).
- Fix: on /2.0 the header spans the same `--page-x` gutters as the scene.
- Status: **Fixed.** On /2.0 (≥761 px) the header spans the scene's `--page-x` gutters. Measured right edges, icon vs scene tabs: 1280 → 1199/1203, 1920 → 1804/1808 (was 1510/1790), 3440 → 3324/3328 (icons used to float mid-sky). Subpages untouched — they keep their 1120 px column.

**[A-26] [P1] Mobile/tablet: portrait tablets get the desktop split with tiny islands**
- Principle: treat each form factor as primary, not a resized desktop; Fitts's law (the targets are the islands).
- Evidence: `audit/before/chromium-768-intro.jpg` — at 768×1024 the side-by-side layout leaves the islands ~200 px wide in the lower-right with the top third of the screen empty; same at iPad Pro portrait (1024×1366). Found on the first fix pass, not in the original sweep.
- Why it matters: iPad portrait is a common "checking someone out" device for investors.
- Fix: portrait tablets (761–1100 px, portrait) use the phone's stacked composition — copy on top, the diagonal of islands below at full width — while keeping desktop type sizes and controls.
- Status: **Fixed.** New portrait-tablet block in `IslandHome.module.css`: single column, islands in the phone's diagonal at full width, name on one line. Checked 768×1024 (opening view and Work stop) and 1024×1366. Landscape tablets keep the desktop split, which already fits.

### P2

**[A-11] [P2] Performance: desktop pulls ~3.7 MB of 3D models before any intent**
- Principle: "fast, content-first" (Paco/Lee); Vercel "load only what's needed".
- Evidence: `audit/before/weight.json` — desktop initial 4.7 MB within 6 s idle, of which 3.7 MB are `.glb` fetches: `flight-*.glb` ×3 (3.6 MB) on a 2.5 s timer (`IslandScrollTransport.tsx:465-478`) and `orbit-work.glb` (1.8 MB). Mobile is fine (730 KB initial).
- Fix: flight models wait for the first sign of travel (wheel/touch/key/tab focus), which the stage already tracks as `data-warm`. Taipei's orbit preload stays — its click flies through the real model.
- Status: **Fixed.** Flight models now load on the first sign of travel (`data-warm`: wheel, touch, key, tab focus, hash jump) instead of a 2.5 s timer. The first crossing (opening view → Work) is always the 2D zoom, so the models have that whole glide to arrive before Work → Writing needs them. `island-flight.spec` passes. Taipei's orbit preload stays (its click flies through the real model).

**[A-12] [P2] Performance: Taipei's daytime render downloads at night**
- Evidence: mobile `weight.json` — `island-work-day` (452 KB raw + 100 KB resized) is requested on every visit; `LivingIsland.tsx:301-303` mounts it with `loading="lazy"` but it's stacked in the viewport, so lazy does nothing.
- Fix: mount the day image only once day has been chosen (or on hover/focus of the toggle).
- Status: **Fixed (partly).** The Work entry's full-size prefetch now skips the daytime render unless day is showing — saves the 452 KB original on every night visit. The resized day still (~100 KB phone / ~235 KB desktop) still loads with the island so the day/night crossfade never flashes empty; deferring that too would need a load-then-fade toggle. Left as is.

**[A-13] [P2] Edge case: JS disabled leaves a 3,200 px empty void**
- Evidence: `edge-nojs-1280.jpg` — the opening view renders (good), then the 496svh scroll track scrolls through nothing.
- Fix: `<noscript>` style collapsing the track to one viewport. The island links already work as plain links without JS.
- Status: **Fixed.** A `<noscript>` style collapses the scroll track to one viewport and hides the scene tabs and scroll button (they can't move without JS). Island links remain plain links.

**[A-14] [P2] Mobile / copy: contact row is unevenly spaced and ordered differently from the header icons**
- Principle: consistency; one spacing scale.
- Evidence: `chromium-375-hello.jpg` — 4 equal grid columns with centred words give "Email ····· X ····· LinkedIn · Substack". Header order is X, Email, Substack, LinkedIn; the stop's order is Email, X, LinkedIn, Substack.
- Fix: left-aligned flex row with a consistent gap and 44 px targets; one order everywhere (Email, X, LinkedIn, Substack — email first because that's what a founder wants).
- Status: **Fixed.** Phone contact row is a left-aligned flex row with even 1.5 rem visual gaps, every link ≥ 44×44 (Email 57, X 44, LinkedIn 80, Substack 88 px wide). Header icons reordered to match: Email, X, LinkedIn, Substack — site-wide, since SiteNav is shared.

**[A-15] [P2] Visual design: type scale sprawl**
- Principle: one type scale, no exceptions.
- Evidence: `IslandHome.module.css` uses 0.75, 0.8125, 0.875, 0.9375, 1, 1.0625, 1.125, 1.1875 and 1.25 rem plus three `clamp()` ranges for what is really three roles: body, UI label, display italic annotation. The cursor tooltip (1.1875rem) and the on-island cue (1.0625–1.25rem) are the same element in two sizes.
- Fix: collapse to tokens (UI 0.875, body 1–1.125, annotation 1.125–1.25).
- Status: **Partly fixed.** The display-italic family (island cue, cursor tooltip, island labels, latest essay title) now uses one token, `--type-annotation` (17 px at 1280) — before it was three different clamps plus a fixed 1.1875 rem. **Deferred:** the UI sizes (0.75/0.8125/0.875/0.9375 rem across tabs, scroll hint, contact and the compact-height overrides). Each one was tuned against a specific short-phone layout the e2e size matrix checks; collapsing them is a careful afternoon, not a drive-by.

**[A-16] [P2] Visual hierarchy: the scene tabs out-shout the copy**
- Principle: hierarchy from weight and colour first; nav secondary (`.impeccable.md`).
- Evidence: `.chapterLabel` is 700 weight (`IslandHome.module.css:303`) — the heaviest text on screen after the H1 — while the descriptive sentences are 400.
- Fix: 500 weight, keep the colour logic for the current tab.
- Status: **Fixed.** Scene tab labels 700 → 500 weight; the current tab still reads as current through colour and glow, not weight. Rest colour unchanged.

**[A-17] [P2] Interaction: orbit drag has no momentum and hits a wall at its limits**
- Principle: drag needs momentum and rubber-banding (Rauno/Emil).
- Evidence: `lib/island-orbit.ts:255-257` hard-clamps yaw to ±0.65 rad; release stops dead (`IslandOrbit.tsx:211`).
- Fix: release with decaying velocity; soft resistance past the limit that springs back.
- Status: _open_

**[A-18] [P2] Copy: "early stage" should be hyphenated as a compound modifier**
- Evidence: `IslandHome.tsx:32`.
- Fix: "early-stage". Logged in the copy-change list.
- Status: **Fixed.** "early stage startups" → "early-stage startups" in the hero.

**[A-19] [P2] Interaction: cursor tooltip takes ~500 ms to finish drawing**
- Principle: UI motion under ~300 ms; tooltips in a group shouldn't re-delay.
- Evidence: `.islandTip[data-visible] .tipText` — 150 ms delay + 360 ms translate / 420 ms underline (`IslandHome.module.css:506-511`).
- Fix: total ≤ 250 ms.
- Status: **Fixed.** Tooltip draws star → line → words in 270 ms total (was ~620 ms: 150–200 ms delays plus 360–420 ms transitions). The order is kept; only the clock is shorter.

### Flagged, not changed (needs Carter)

- **[A-20] Content discrepancy.** `/work` (and the hidden Work preview on /2.0) says "screened and interviewed **350+** early-stage startups"; `PRODUCT.md` lists "**250+** startups screened". One of them is wrong.
- **[A-21] Copy repetition.** Intro says "…at 886 Studios", the Work stop one screen later says "associate at 886 Studios, working on ikigai Launchpad in Taipei." Projects is "fun" twice ("building things for fun on the side" → "fun projects i made."). Lowercase "i" on /2.0 vs "I" on /work. I left all of it: it's voice, and these are your words. Suggestion if you want one change: Projects stop → "things i've built for fun." or name two projects.
- **[A-22] Scene tabs vs pages.** "Work · Writing · Projects" at the bottom are camera controls; on every subpage the same three words are page links. I kept them as camera controls (they double as the scroll-position indicator, and the islands now carry visible labels that do open pages), but it's the one remaining Jakob's-law tax.
- **[A-23] Lead verification (from the brief).** "Now / 886 content before the skip link": it's `WorkWindowPreview`, rendered `hidden inert aria-hidden` — screen readers and Tab never reach it (confirmed in the accessibility tree). It's source for the Work entry's window effect. Harmless; left. "drag/swipe to look around both in the DOM": both are `aria-hidden`, so neither is read; only one is displayed per pointer type. Not a bug. "Island images request 3840 px": the `srcset` lists up to 3840w but browsers pick 640–1920w for the displayed size (`weight.json`); alt="" is correct because each island link has its own accessible name. "Islands nav renders twice": the opening and closing views each render the three islands; the closing one is `inert`/`aria-hidden` until you reach it. Fine.
- **[A-24] Day/night toggle on Taipei.** A one-off control with no peer anywhere. Passes "what breaks if I delete it?" only as delight. Kept; it's labeled, small, and only on one stop.
- **[A-25] Skip link outside a landmark** (axe `region`, moderate). Skip links conventionally sit before landmarks; won't fix.

## Keep — protect these while fixing

- **The opening view's text renders at 1 s on Slow 4G** (`slow4g-mobile-1s.jpg`): name and intro paint before any art. Never put the copy behind the video or images.
- **The starfield is a 240 KB MP4 with `preload="none"`, a 6 KB poster, and stills under reduced motion / Save-Data.** That's exactly right; don't trade it for a heavier "better" loop.
- **Reduced motion is a real alternative, not an off switch:** stops jump instantly, entries navigate directly, art is still, orbit still works by arrow keys (`edge-reduced-*.jpg`).
- **The mobile opening view** (`chromium-375-intro.jpg`): labeled islands in a diagonal, name and copy above, tabs below. It's the best screen on the site.
- **The Blender islands themselves.** Consistent lighting, scale and palette across all three; they read as places, not clip-art.
- **Hero copy.** "backing early stage startups alongside the founders of Twitch and Guitar Hero at 886 Studios." says who, what, and why-care in one line. Don't dilute it with a tagline.
- **Keyboard model:** skip link first, then social, hero links, islands, scroll button, tabs; departing scenes go `inert` and focus is handed to the active tab. Sensible and complete.
- **CLS 0, TBT ≤ 40 ms** on both Lighthouse runs.

## Copy changes (for review)

- **A-04 · meta description** (`lib/seo.ts`): "Carter Wang's personal website." → "Backing early-stage startups alongside the founders of Twitch and Guitar Hero at 886 Studios. Writing and building things for fun on the side." Your hero sentence, sentence-cased for a meta context. Also feeds the web manifest and WebSite JSON-LD. Note this changes the live homepage's description too once merged.
- **A-03 · new label** on the opening view: "latest essay" followed by the title of `essays[0]` ("The Cost of Keeping Up"), linking straight to the Substack post. The only new words are the two-word lowercase label; the title updates itself when you add an essay to `content/portfolio.ts`.
- **A-18 · hero** (`components/IslandHome.tsx`): "backing early stage startups" → "backing early-stage startups". Grammar only (compound modifier); same as /work's own "early-stage".

## Judgment calls

- **A-04 · Restored a share image**, reversing `53930d7`. The new `public/og-image.jpg` is a capture of the real opening view (name + three islands, body copy hidden because it's unreadable at unfurl size). Alternative: keep no image and only fix the description — revert the image lines in `lib/seo.ts`. All subpages share the same image for now; per-page images (e.g. the open notebook for /writing) would be better but need renders you'd want to approve.
- **A-03 · Latest essay on the opening view**, not only on the Writing stop. Most 30-second visitors never leave the opening view, and this is the only way to reach an essay in one click. Alternative rejected: an essay list or card on the Writing stop (more chrome, still two steps from landing).
- **A-05 · Kept scroll snapping between islands**, only shortened it. The principle says never fight native scroll; the design says never rest between islands. The islands win because a half-crossed frame is visually broken, and the settle only fires after a gesture ends (it never interrupts momentum).
- **A-14 · Email first** in both the header icons and the "say hi" links (header was X first). Founders and investors who want to reach you mostly want email; one order everywhere beats two. Alternative: X first everywhere, if X is where you'd rather be found.
