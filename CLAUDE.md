# Project instructions for Claude Code

## Git workflow

- Commit and push after every change, without asking for confirmation first. This applies to routine edits in this repo.
- After pushing, always summarize what was actually committed: file + line, what changed (before → after), and why (the underlying reason/bug), not just "committed and pushed."
- Still use judgment and confirm before any genuinely destructive/hard-to-reverse git operation (force-push, `reset --hard`, rewriting published history, etc.) — the "commit freely" rule only covers normal forward commits.

## Deployment

- Vercel project: `portfolio-website` (link with `vercel link --project portfolio-website` if not already linked on a machine).
- Production domain: `carterkowang.com`.

## Design context

- Read `.impeccable.md` before making visual/design changes — it holds the site's brand personality, aesthetic direction, and design principles (cosmic/immersive personal site, restrained hierarchy, no invented copy).

## `app/globals.css` gotcha

- The file has legacy, unprefixed selectors (`.world-work`, `.world-writing`, `.world-visual`, etc.) at several breakpoints, left over from an older layout. These coexist with the active `.cosmic-home .world-card.world-work ...`-prefixed rules that the homepage constellation actually uses — the prefixed rules win on specificity, so the unprefixed ones are currently harmless dead weight *for the homepage*.
- Before editing or deleting any unprefixed `.world-*` rule, check whether the `/work`, `/writing`, or `/projects` topic pages depend on it without the `.cosmic-home` wrapper — deleting blind could silently break those pages instead of the homepage.
