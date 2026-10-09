# /2.0 design audit

## Session summary

Everything is on branch `design-audit` (pushed; nothing merged, nothing deployed to production). 26 commits: one per fix (A-03 has a small-phone follow-up), plus the baseline, one test-update commit and this summary.

### Before → after

| Measure | Before (`main` @ e69ab6f) | After (`design-audit`) |
|---|---|---|
| Lighthouse mobile: perf / a11y / best practices / SEO | 91 / 100 / 96 / 69 | 93 / 100 / 96 / 69 (median of 3; single runs vary ±3) |
| Lighthouse desktop | 100 / 100 / 96 / 69 | 100 / 100 / 96 / 69 |
| Mobile LCP / TBT / CLS | 3.3 s / 40 ms / 0 | 3.2 s / 20 ms / 0 |
| axe-core (each of 375/768/1280/1920) | 1 serious (label-content-name-mismatch), 1 moderate (region) | 0 serious, 1 moderate (region: the skip link, won't fix) |
| Click island → destination heading (real GPU) | 2,248 ms | 970 ms |
| Click hero text link "writing" → /writing | 2,303 ms | 86 ms |
| One wheel tick / arrow key → settled on next island | 909 / 914 ms | 689 / 694 ms |
| Desktop bytes in the first 6 s, no interaction | 4,711 KB (3.7 MB of 3D models) | 860 KB |
| Mobile bytes after visiting every stop | 2,537 KB | 2,087 KB |
| Link preview | grey box; "Carter Wang's personal website." | real capture of the islands + your hero sentence |
| Visible way into a page on the desktop opening view | none until hover | labeled islands, underlined links, latest essay |

SEO 69 is entirely `noindex` on /2.0, which is deliberate until it replaces `/`. Raw data: `audit/before/` vs `audit/after/` (screenshots, Lighthouse JSON+HTML, `axe.json`, `weight.json`, `taborder-*.json`, `aria-*.yaml`, `link-previews.jpg`), and `audit/after/timing.txt` for the click timings on GPU and software WebGL. The `before` timings came from the same harness run against `main`.

### What changed, by category

- **Speed and interaction:** A-01 entry 2.8 s → 1.15 s, text links skip the flight (`27dc623`) · A-05 shorter glide (`475a3b0`) · A-19 tooltip in ~270 ms (`d1dba4a`) · A-17 drag momentum and rubber-band (`d560fdb`) · A-27 no 3D flight build mid-entry or on software WebGL (`bec0b2c`)
- **Wayfinding and IA:** A-02 labeled islands and underlined links on desktop (`501ef2d`) · A-03 latest essay one click from landing (`968ebc8`, small-phone follow-up `7546c60`) · A-09 orbit hint no longer hides the call to action (`78580f5`)
- **Layout and visual:** A-10 header on the scene's gutters (`af73d3e`) · A-26 portrait tablets stack (`a66d689`) · A-14 even contact row, one social order (`5a2ba7b`) · A-16 lighter scene tabs (`a7d2aa0`) · A-15 one annotation size (`5acb958`)
- **Accessibility:** A-06 2 px focus rings (`1a9a809`) · A-07 label in name for the scroll button (`f910166`) · A-08 island links named by their label (`82fc959`)
- **Performance:** A-11 flight models on travel intent (`61a238c`) · A-12 no daytime render prefetch at night (`8366490`)
- **Metadata:** A-04 share image + description (`5e21195`)
- **Edge cases:** A-13 no empty void without JS (`3bda39d`)
- **Copy:** A-18 "early-stage" (`ff48895`) · A-28 a reason to say hi (`9cdc59b`)
- **Tests:** selectors and expectations updated for A-01/A-07/A-08/A-09 (`26e530d`, `82fc959`)

### Copy you need to review

All four are listed with before → after under **Copy changes** at the bottom. In short: (1) meta description is now your hero sentence; (2) new two-word label "latest essay" on the opening view; (3) "early stage" → "early-stage"; (4) "Building something? I'd love to hear about it." copied from /work onto the say-hi stop. No other wording was changed.

### Judgment calls

See **Judgment calls** at the bottom. The big ones: the flight stays on islands but is ~1 s; scroll snapping stays but is faster; island labels and scene tabs both stay (a known Jakob's-law cost); a share image is back, reversing your July commit `53930d7`; email is now first in the social order.

### Still open, and why

- **A-20 · 350+ vs 250+ startups screened.** /work and `PRODUCT.md` disagree. Only you know which is right.
- **A-21 · Copy repetition and casing.** "886 Studios" on two adjacent screens, "fun" twice, lowercase "i" vs "I". Your voice, so I flagged it and left it alone.
- **A-22 · Scene tabs vs page links.** Same words, different results. My call was to keep them (see judgment calls); hiding the tab labels on the opening view is the alternative.
- **A-27 (orbit half) · drag-to-rotate models on software WebGL** can still stall a click on blocklisted-GPU machines. Gating them needs a test-infra decision: the e2e suite itself runs on software WebGL. Either launch Playwright with `--use-angle=metal` (Mac-only) or add a test-only override, then gate the orbit the way flights are gated.
- **A-15 (rest) · UI type sizes** (0.75–0.9375 rem) still vary; each is tuned to a short-phone layout that the e2e size matrix checks.
- **A-12 (rest) · the resized day still** (~100–235 KB) still loads at night so the crossfade never flashes.
- **Per-page share images.** All pages share the opening-view capture. A notebook render for /writing and the workshop for /projects would be better, and you'd want to choose those frames yourself.
- **Pre-existing test failures, unchanged by this branch** (each verified failing on `main`): `island-polish.spec.ts:112` (desktop + mobile; a strict-mode locator matching 5 spans), `rocket-smoke.spec.ts:542` ×2 (desktop; outbound links never become visible), `island-flight.spec.ts:119` (mobile; 6 px off a 3 px tolerance). `motion-responsiveness.spec.ts:42` is flaky (failed once in the full run, passed on 2 reruns). Final run on this branch: 163 passed, 6 failed (those five failures, plus the one flake), 29 skipped (desktop + mobile projects).
- **Not tested:** a physical iPhone (Safari was tested as Playwright WebKit at 375/768/1280/1920), iOS Low Power Mode, and the Vercel preview deployment of this branch.

### Look at these three first

1. **Click an island** on the branch preview (or `npm run build && npm start`, then open /2.0). The entry now takes about a second instead of nearly three. Check that it still feels like *the* moment of the site. If you want a little more, change the one constant `ISLAND_ENTRY_DURATION` in `lib/island-entry-motion.ts`; everything else scales from it.
2. **The share card** (`public/og-image.jpg`, `audit/after/link-previews.jpg`). It reverses your deliberate July removal, so keep it or revert it consciously.
3. **The new opening view on a laptop**: labels under the islands, underlined links, and the "latest essay" line. These are the most visible changes to the first five seconds, and the line is the only new copy on that screen.

## Method

Branch: `design-audit` (never merged, never deployed to production). Baseline captures live in `audit/before/`, post-fix captures in `audit/after/`.

How this was measured: production build (`next build && next start`) on localhost, driven with Playwright (Chromium + WebKit) at 375 / 768 / 1280 / 1920 px, plus 3440 ultra-wide, 640 px @2x (≈200% zoom on a laptop), 844×390 landscape phone, reduced motion, JS disabled, and blocked video. Lighthouse 13.5 mobile + desktop, axe-core 4.14 at all four widths, a 25-stop keyboard Tab walk, Slow-4G + 4× CPU throttled loads at 1/3/6 s, and a timing harness that clicks into each island and measures click → destination heading.

The site is dark-only (`<html data-theme="dark">`, no light theme exists), so there is no light-mode capture. That is a deliberate brand choice, not a finding.

## Follow-up: Carter's review (round 2)

- **Home screen:** the "latest essay" line is gone (`1f9fe78`).
- **Pace:** island entries slowed from 1.15 s to 2.5 s (`f8a1782`). One constant, `ISLAND_ENTRY_DURATION` in `lib/island-entry-motion.ts`.
- **Writing entry rebuilt with more craft** (A-29, `c03fffb`): the notebook lifts off the desk, leaves curl and cast shadows as they're thumbed over, the titles ink in, and the notebook dissolves before the archive rows rise in. This also fixes a paint-order bug where the leaves sat behind the right page. Frames: `audit/writing-entry/`.

### Mobile performance

Measured on a production build: an iPhone-sized viewport (390×844 @3×) with a real GPU, the CPU throttled 4× while scrolling, and the same journey before and after (open → Work → Writing → Projects). Raw data is in `audit/mobile-perf/`.

| | Before | After |
|---|---|---|
| Bytes, opening view | 735 KB | 668 KB (the video still loads, but after the page is up) |
| Bytes, first trip to Work | 532 KB | 199 KB |
| Bytes, Work-entry prefetch | 456 KB | 218 KB |
| **Whole phone visit** | **1,723 KB** | **1,085 KB (−37%)** |
| Scroll frames at 4× CPU, p50 / p95 | 12–13 / 27 ms | 11–12 / 26 ms (unchanged; it was never the problem) |
| Lighthouse mobile perf, median of 3 | 90 | 92 |
| Lighthouse simulated LCP, median | 3.6 s | 3.4 s |

**What changed:**
- **M-01** `6257283`: the 237 KB starfield loop waits for load + idle, so it no longer competes with first paint.
- **M-02** `0c02adf`: island stills at q75 instead of q90 (−38%, no visible difference at display size; `quality-90-86-75.png`).
- **M-03** `81f12ec`: the island's monitor uses a 384 px thumbnail instead of a 1200 px shot; deck cards 2–8 use 750 px renditions. Card 1 stays the original so it docks into /projects' first row as the identical image.
- **M-04** `5cc4f92`: Taipei's daytime still loads on toggle intent. The switch waits for the image to decode, and the sun "breathes" while it does.
- **M-05** `902bc7e`: phones prefetch a 2048 px Taipei for the Work push, not the 2880 px original. Desktop is unchanged.

**Tried and rejected:** Next's `experimental.inlineCss`. It removes the render-blocking stylesheet requests, but it inlines all of `globals.css` into every page (+116 KB of uncacheable HTML) for a marginal LCP change (3.2 s median) and worse TBT (70–100 ms).

**What's left:** the simulated LCP is bandwidth. On 4G the three island images download alongside the CSS, 60 KB of fonts and 164 KB of JS.

**Legacy CSS, measured (correcting my earlier claim that it was "the next real win"):** I crawled all 11 routes and stops at desktop and phone widths and checked every rule in every stylesheet against the live DOM (`audit/mobile-perf/css-usage.json`). The site-wide stylesheet (globals + Tailwind + @font-face) is 86 KB raw / **19 KB gzipped**. Of its 733 rules, 148 (15 KB raw, roughly **3 KB gzipped**) never match on any page. Some of those are dead legacy (`.work-current`, `.research-panel`, `.skill-panel`, `.subpage-panel`, `.world-intro`, `.world-enter-cue`, `.essay-title`…), some are stray Tailwind utilities (`.transition`, `.ring`, `.filter`), and some only apply in states a static scan can't see (scrolled nav, hover). The module CSS that looks "unused" (`WorkshopEntry`, `IslandHome` state rules) is transition and state styling, and it's needed. **Conclusion:** pruning would save ~3 KB over the wire (~15 ms on 4G). That's worth doing for maintainability, but it is not a performance lever. The render-blocking cost is the round trip, not the size.

**Done at Carter's request (CSS cleanup):** removed 109 dead selectors (75 whole rules, 512 lines: `globals.css` 3,610 → 3,098 lines; built stylesheet 86.0 → 78.0 KB raw). A selector was removed only if it passed **both** tests: (1) at least one of its class names appears nowhere in the site's code (classes built at runtime, like `` `world-${id}` `` on the live homepage, count as present, so the `.world-*` rules your CLAUDE.md warns about were kept), and (2) it matched nothing on any of 11 pages/stops at 1280 and 390 px, scrolled and unscrolled. Proof of no change: computed styles of all 13,953 elements compared before/after (the only differences were capture timing, confirmed by re-reading them on the old build), and 30 of 34 full-page screenshots pixel-identical (the other 4 are /resume, whose starfield is randomized: two captures of the *same* build differ in the same region). The list of removed selectors and the scripts are in `audit/css-cleanup/`. Separately, all Playfair italics on the site (island labels, cues, notebook titles) were browser-synthesized, because only the upright face was loaded. **Done at Carter's request:** the real italic now loads (+38 KB, one font file); see `audit/mobile-perf/italic-faux-vs-real.jpg`.

### Blurry islands (Carter's report)

Measured as edge energy (variance of a Laplacian) on a crop of downtown Taipei at the Work stop, with a real GPU, loaded directly and after flying in. Raw numbers are in `audit/sharpness/`, crops in `before-after-crops.jpg`.

| | Before | After |
|---|---|---|
| Retina laptop (1440 @2×) | 902 | 1,159 (+28%) |
| iPhone (390 @3×) | 921 | 1,833–2,118 (+100–130%) |

- **Cause 1, laptops (pre-existing):** the depth-parallax canvas that redraws the island at a stop was capped at 1.5× pixel density, so a Retina screen saw it at 75% resolution. The 3D drag view had the same cap. Now: full device density for the parallax (it only redraws on pointer movement) and 2× for the drag view, on real GPUs. Software WebGL keeps 1.5×; with full density there it made an already-flaky orbit test (`island-orbit.spec.ts:147`, fails ~1 in 3 on the previous commit too) fail every time.
- **Cause 2, phones (pre-existing):** the stop images were requested for 90vw, but on phones the island overhangs the screen and shows at ~115vw, so phones upscaled a 1080px file to ~1,314 device pixels. Now `sizes` says 115vw, so phones get 1920px. This costs about +210 KB over a full phone visit (≈1.3 MB total, still well below the original 1.72 MB).
- **Not the cause:** my q75 compression change. At display size, q75, q86 and q90 measure within 1–2% of each other, so q75 stays.
- **Also not the cause:** flying in versus loading directly. There's no difference, so no stale raster scale after the zoom.

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
- Status: **Fixed, then re-paced after review.** First pass cut the entry 2800 → 1150 ms; Carter found that too rushed, so it's now **2500 ms** (approach 1800, arrival 700). Hero text links still skip the flight entirely (2140 → ~90 ms). All choreography scales from the one constant `ISLAND_ENTRY_DURATION` in `lib/island-entry-motion.ts`.

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
- Status: **Reverted at Carter's request** (follow-up review): the "latest essay" line is gone from the opening view, along with its short-phone spacing tweaks. Essays are one click away via the hero's "writing" link (now instant, A-01) and then one more to Substack.

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

**[A-27] [P1] Performance: building the 3D flight world could freeze an island entry for seconds**
- Principle: Doherty threshold; "never block input" (Rauno/Emil).
- Evidence: found in the re-check. With the camera resting on #writing, ~1 in 3 clicks took 3.6–5.2 s to reach /writing — **on `main` too** (4781 / 5229 ms vs a normal 2361 ms). A PerformanceObserver showed a single 3,610 ms long task starting ~100 ms after the click: the flight world (renderer + three GLB parses) built on a `requestIdleCallback` with a 4 s timeout, which can fire mid-entry. On a real GPU (Apple M2 via Metal) the build has no task over 100 ms, so the freeze is specific to **software WebGL** — which is exactly what Chrome falls back to on blocklisted GPUs, VMs and remote desktops.
- Fix: (1) skip 3D flights when the WebGL renderer is software (SwiftShader / llvmpipe / "Basic Render"); the 2D crossings remain; (2) start the build only when the camera is at rest (not travelling, gliding, scrolling or entering), retrying every 600 ms, and never once an entry has begun.
- Status: **Fixed for flights; orbit left open.** `lib/hardware-webgl.ts` + an at-rest guard in `IslandScrollTransport`. After: GPU entries #writing→/writing 899 ms (5/5 runs steady); software WebGL no longer builds flights. **Still open:** the drag-to-rotate orbit model loads on hover and can stall the same way on software WebGL (seen once in 3 software runs). Gating it on `hardwareWebGL()` was tried and reverted, because the e2e suite runs on software WebGL and nine orbit tests would lose their model. Fix options for you: run Playwright with `--use-angle=metal` (Mac-only) or add a test-only override, then gate the orbit too.

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
- Status: **Fixed.** Drags now stretch up to 0.1 rad past the ±0.65 limit against growing resistance and spring back on release (τ 90 ms); a flick coasts on its last ~80 ms of velocity (τ 220 ms, capped) and brakes hard at the edge. Keys and reset keep their exact hard limits; reduced motion and a pointer that stopped before letting go get no coast; a cancelled pointer (page took the gesture) stops dead. Verified with synthetic 16 ms-spaced events: release 0.19 → coasts to 0.64; overdrag 0.73 → settles 0.650. Caught and fixed along the way: a rAF timestamp earlier than the release produced a negative step that flung the island backwards. All orbit e2e specs pass.

**[A-18] [P2] Copy: "early stage" should be hyphenated as a compound modifier**
- Evidence: `IslandHome.tsx:32`.
- Fix: "early-stage". Logged in the copy-change list.
- Status: **Fixed.** "early stage startups" → "early-stage startups" in the hero.

**[A-19] [P2] Interaction: cursor tooltip takes ~500 ms to finish drawing**
- Principle: UI motion under ~300 ms; tooltips in a group shouldn't re-delay.
- Evidence: `.islandTip[data-visible] .tipText` — 150 ms delay + 360 ms translate / 420 ms underline (`IslandHome.module.css:506-511`).
- Fix: total ≤ 250 ms.
- Status: **Fixed.** Tooltip draws star → line → words in 270 ms total (was ~620 ms: 150–200 ms delays plus 360–420 ms transitions). The order is kept; only the clock is shorter.

**[A-28] [P2] Copy: "say hi!" gives no reason to reach out**
- Principle: every screen needs a next step (Vercel guidelines); audience #1 is founders.
- Evidence: second pass, `audit/after/chromium-1280-hello.jpg` — a heading and four bare links. Your /work page already ends with the line a founder needs.
- Fix: reuse it verbatim under the heading: "Building something? I'd love to hear about it."
- Status: **Fixed.** Line added under "say hi!"; checked 1280 and 320×568 (islands still clear the prompt).

**[A-29] [P1] Interaction: the Writing entry lacked craft, and had a paint-order bug** *(from Carter's review)*
- Principle: motion with a physical origin (Rauno/Emil); "more attention to detail".
- Evidence: `audit/writing-entry/before-realtime.jpg`. (1) Bug: the notebook's opacity animation flattened its 3D context, so it painted in DOM order — the turning leaves sat *behind* the right page, whose titles showed from the first frame. (2) The book reached full size almost at once, with no sense of lifting off the desk. (3) Three flat, rigid leaves. (4) ~800 ms of a static open book. (5) The handoff cross-faded the notebook's titles over the page's text at 50%.
- Fix: fades moved to a wrapper so the notebook keeps true depth sorting; the book rises off the desk, tips a touch past upright and settles; leaves are thumbed over with a cadence, each curling (two hinged halves, the outer one trailing then whipping over), shading as it turns from the lamp and casting a moving shadow on the pages beneath; the titles ink in line by line once revealed; paper grain, stacked page edges and a ribbon marker; the notebook holds a beat, dissolves, *then* the heading and each essay row rise in on the page. Captures: `after-lift-desktop.jpg`, `after-lift-phone.jpg`, `after-handoff.jpg`.
- Status: **Fixed.** `book-entry.spec` passes on desktop and mobile (one assertion now targets the left page, since the right page moved ahead of the leaves in the DOM as a paint-order safety net).

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
- ~~**A-03 · new label** on the opening view~~ (removed after review): "latest essay" followed by the title of `essays[0]` ("The Cost of Keeping Up"), linking straight to the Substack post. The only new words are the two-word lowercase label; the title updates itself when you add an essay to `content/portfolio.ts`.
- **A-18 · hero** (`components/IslandHome.tsx`): "backing early stage startups" → "backing early-stage startups". Grammar only (compound modifier); same as /work's own "early-stage".
- **A-28 · "say hi!" stop** (`components/IslandHome.tsx`): added "Building something? I'd love to hear about it." — copied word for word from the end of /work. Note it's sentence-case while the rest of /2.0 is lowercase; I kept your original casing rather than edit your words.

## Judgment calls

- **A-04 · Restored a share image**, reversing `53930d7`. The new `public/og-image.jpg` is a capture of the real opening view (name + three islands, body copy hidden because it's unreadable at unfurl size). Alternative: keep no image and only fix the description — revert the image lines in `lib/seo.ts`. All subpages share the same image for now; per-page images (e.g. the open notebook for /writing) would be better but need renders you'd want to approve.
- ~~**A-03 · Latest essay on the opening view**~~ — removed after Carter's review. Most 30-second visitors never leave the opening view, and this is the only way to reach an essay in one click. Alternative rejected: an essay list or card on the Writing stop (more chrome, still two steps from landing).
- **A-05 · Kept scroll snapping between islands**, only shortened it. The principle says never fight native scroll; the design says never rest between islands. The islands win because a half-crossed frame is visually broken, and the settle only fires after a gesture ends (it never interrupts momentum).
- **A-14 · Email first** in both the header icons and the "say hi" links (header was X first). Founders and investors who want to reach you mostly want email; one order everywhere beats two. Alternative: X first everywhere, if X is where you'd rather be found.
- **A-01 · The flight stays on islands and stop headings**, shortened to ~1 s; only plain text links skip it. Alternative rejected: no flight at all (navigate instantly everywhere). The entry is the site's one signature moment; at 1 s it's a reward, at 2.8 s it was a gate.
- **A-02 / A-22 · Island labels *and* scene tabs both say Work · Writing · Projects** on the opening view (on desktop they now sit ~40 px apart at 1280×800). One opens the page, the other moves the camera — a real Jakob's-law cost. I kept both: the tabs are the only persistent wayfinding and progress indicator across all five stops, and hiding them only on the opening view would make the nav pop in and out. Alternative if this bothers you: hide the tab *labels* (keep the comet line) on the opening and closing views.
- **Header icons stay on the "say hi" stop** even though the same four links are in the copy. A global header that disappears on one stop is a worse inconsistency than a duplicate there.
- **The starfield loop has no pause control** (Vercel: loops over 5 s should be pausable). It's ambient background at 0.55× speed, it stills for reduced motion, Save-Data and hidden tabs, and a visible pause button would be chrome on the one screen that should have none. Kept.
- **A-27 · Software-WebGL gating for flights only.** The orbit models (drag to look around) would benefit from the same gate, but the e2e suite runs on software WebGL; gating there needs a test-infra decision from you (see open items).
