# Project instructions for Claude Code

## Git workflow

- Commit and push after every change, without asking for confirmation first. This applies to routine edits in this repo.
- After pushing, always summarize what was actually committed: file + line, what changed (before → after), and why (the underlying reason/bug), not just "committed and pushed."
- Still use judgment and confirm before any genuinely destructive/hard-to-reverse git operation (force-push, `reset --hard`, rewriting published history, etc.) — the "commit freely" rule only covers normal forward commits.

## Deployment

- Vercel project: `portfolio-website` (link with `vercel link --project portfolio-website` if not already linked on a machine).
- Production domain: `carterkowang.com`.
