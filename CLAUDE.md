# HomeHub — Claude Code Rules

This file defines how Claude Code operates in this repo. Follow these rules on every task without being asked.

---

## Branching

- Always work on a feature branch. Never commit directly to `main`.
- Branch naming: `feature/short-description`
  - Use lowercase, hyphens only, brief but descriptive
  - Examples: `feature/self-host-fonts`, `feature/influxdb-setup`, `feature/api-js-module`
- Create the branch before making any changes:
  ```bash
  git checkout -b feature/your-description
  ```

---

## Commits

- Commit logical units of work — don't bundle unrelated changes
- Message format: short plain English summary, imperative tone, no period
  - Good: `Add deploy script`, `Self-host Google Fonts`, `Fix nginx config`
  - Bad: `changes`, `updated stuff`, `WIP`, `fixed it`
- Keep the subject line under 72 characters
- If more context is needed, add a blank line then a short body paragraph

---

## Pull Requests

- Every feature branch must have a PR opened to `main` when the work is complete — never merge directly
- PR title: same format as commit messages — short, plain English, imperative
- PR description must include:
  - **What changed** — one or two sentences on what was done
  - **Why** — the reason or problem it solves
  - **How to test** — how to verify it works (even if simple, e.g. "open browser at homehub.local")
  - **Screenshots** — if any visual change to the dashboard
- Use the GitHub CLI to create PRs from the terminal:
  ```bash
  gh pr create --title "Your title" --body "..." --base main
  ```
- Always push the branch before creating the PR:
  ```bash
  git push -u origin feature/your-description
  ```

---

## Spec Docs

Two living spec documents live in `docs/`. They are the source of truth for project state.

| File | Covers |
|------|--------|
| `docs/project-spec.md` | Master project spec — phases, architecture, backlog, sensor inventory |
| `docs/games-spec.md` | Games section — current games, roadmap, future ideas |

- **Update the relevant spec in the same PR** that completes the tracked work
- Mark completed tasks with `✅` in roadmap tables or `- [x]` in checklists
- Update the `Last updated` date at the top of the file whenever it changes
- If a new decision is made or a backlog item is added, update the spec before closing the PR

---

## General Rules

- **Never commit secrets.** WiFi passwords, API tokens, InfluxDB credentials all go in `secrets.yaml` which is gitignored.
- **Never commit data.** No CSV exports, no databases, no sensor readings.
- **No speculative files.** Don't create files or configs that aren't needed right now.
- **Scripts go in `scripts/`.** Root stays minimal.
- **No external runtime requests.** The dashboard must not call any external URLs when running. All assets must be self-hosted.
- Always run `git status` before starting work so you know the current state of the repo.
- If something is unclear, ask before making changes.

---

## Project Structure

```
homehub/
├── apps/
│   ├── dashboard/      # Main dashboard — home-hub.html, fonts.css, three.min.js, fonts/
│   └── games/          # Games hub — index.html, puzzles/
├── nginx/              # Nginx server configs
│   └── homehub.conf
├── esphome/            # ESPHome sensor configs (one .yaml per node)
├── docs/               # Build guides and documentation
├── scripts/            # Operational scripts (deploy, backup, etc.)
├── secrets.example.yaml
├── .gitignore
├── CLAUDE.md           # This file
└── README.md
```

---

## Stack Reference

- **Pi hostname:** `homehub.local` · `192.168.0.74`
- **Pi user:** `sethpthomas91`
- **Web root:** `/var/www/homehub`
- **Serving:** Nginx at `http://homehub.local`
- **Deploy:** `./scripts/deploy.sh`
- **Sensors:** ESP32 + DHT22 via ESPHome → Home Assistant
- **Data store:** InfluxDB (planned)
- **Broker:** Mosquitto MQTT (planned)