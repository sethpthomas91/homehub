# HomeHub Games — Project Document
> Last updated: 2026-03-08 | Status: **Active — Phase 1**
> Served at: `http://homehub.local/games`

---

## What this is
A locally hosted games section of the HomeHub Pi. One game per day, shared by the whole household. No accounts, no internet, no ads. Just something fun to come back to daily.

---

## Current Games

| Game | Status | Notes |
|------|--------|-------|
| Mini Crossword | **In progress** | Daily puzzle, variable grid size (up to 9×9), 30 puzzles to start |

---

## Phase 1 — Mini Crossword Foundation
**Goal:** A working daily crossword that feels polished enough to actually use.

| Task | Status | Notes |
|------|--------|-------|
| Base crossword player | ✅ Done | PR #8 |
| Dynamic grid sizing | ✅ Done | Any size up to `MAX_GRID_SIZE` (9); `rows`/`cols` required puzzle fields |
| 30 original puzzles | **In progress** | Themed, verified grids; variable size allowed |
| Daily puzzle mechanic | **In progress** | Date-based, no skipping ahead |
| Progress persistence | **In progress** | localStorage, clears at midnight |
| Mobile/tablet layout | **In progress** | Tap to select, keyboard friendly |

---

## Phase 2 — Crossword Improvements
*Hold until Phase 1 is live and being used.*

| Feature | Notes |
|---------|-------|
| Streak tracking | "🔥 5 days in a row" — positive retention mechanic |
| Completion screen | Solve time, streak count, small celebration moment |
| Puzzle title shown before play | Today's date + theme visible before starting |
| More puzzles | Add seasonal packs — aim for 365 eventually |
| Better mobile tap behavior | Tap cell to select, tap again to switch direction |

---

## Future Games (Ideas)
*No work started. Add here when the idea comes up.*

| Game | Notes |
|------|-------|
| Word search | Easy to generate, good for all ages |
| Trivia | Household trivia, themed packs |
| Board game score tracker | Track who won what over time |

---

## Design Principles
- One thing per day — minimize binging, maximize daily return
- Whole household shares the same daily puzzle
- Zero external requests at runtime
- Matches HomeHub dark aesthetic
- Simple enough for non-technical family members

---

## Technical Notes
- All games live in `apps/games/` in the homehub repo
- Self-contained HTML files — no build step, no dependencies
- Shared fonts via `../dashboard/fonts.css`
- Nginx routes `/games` to `apps/games/index.html`
- `.puz` source files live in `apps/games/puzzles/source/`
- `apps/games/puzzles/manifest.json` maps slot numbers to filenames
- `node scripts/puz-to-js.js` converts the manifest → `puzzles.js`
- Adding a puzzle: drop `.puz` in `source/`, add entry to `manifest.json`, run script
- Puzzle objects require `rows` and `cols` fields (emitted by converter); grids larger than `MAX_GRID_SIZE` (9×9) are rejected at runtime with an error message
- Grid CSS uses custom properties (`--rows`, `--cols`, `--grid-w`, `--grid-h`) set dynamically per puzzle; 60px/cell, capped at 560px