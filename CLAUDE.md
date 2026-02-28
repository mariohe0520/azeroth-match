# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Game Does

WoW-themed match-3 puzzle game (消消乐). Players swap adjacent gems to make rows/columns of 3+ matching gems. 10 WoW zones × 15 levels each. Deployed to GitHub Pages, playable on iOS Safari.

## No Build Step

Pure HTML5 Canvas + vanilla JS. Open `index.html` in browser directly. Deploy: `git push` → GitHub Pages auto-deploys from `main` branch root.

## Architecture

| File | Role |
|------|------|
| `js/board.js` | **Core engine** (1900+ lines). Canvas rendering, grid state, match detection, animation queue, RAF game loop with crash protection. `findMatches()`, `dropAndFill()`, `processMatchChain()` are the key functions. |
| `js/app.js` | Page routing, level launch, callbacks (`onScoreChange`, `onLevelComplete`, `onLevelFail`), modal management |
| `js/gems.js` | 7 WoW gem types. Pre-renders emoji to offscreen canvases for perf. |
| `js/campaign.js` | 10 zones × 15 levels, boss configs, dialogue |
| `js/garden.js` | Herb farming meta-game |
| `js/potion.js` | Alchemy crafting |
| `js/storage.js` | Debounced localStorage with deepMerge migration |

## Critical Invariant

**The RAF loop in board.js must ALWAYS call `requestAnimationFrame(loop)` — NEVER let an exception escape the loop body without recovery.** If it escapes, the game freezes permanently with no error. Wrap all per-frame logic in try/catch and always reschedule.

## Match Logic

- `findMatches()` scans rows then columns for runs of 3+ same-type gems
- 3-match → clear + score
- 4-match → clear 3 + remaining becomes BOMB special gem
- 5-match → LINE BLAST special gem
- `dropAndFill()` runs after every clear: scans each column bottom-to-top, compacts gems down, fills empty top cells with new random gems from `gems.js`

## Deployment

```bash
git add -A && git commit -m "..." && git push
```

If `www/` mirror directory exists, keep it in sync with root JS/HTML/CSS files. GitHub Pages serves from root `/` on `main` branch.
