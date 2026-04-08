# HomeHub — Chores Feature Spec

## Overview
A household chore tracker integrated into HomeHub. Tracks recurring tasks with rolling due dates, completion history, and named users. Self-hosted on the Pi, shared across all devices on the local network.

---

## Stack

| Layer | Technology |
|---|---|
| Database | SQLite (single file, e.g. `homehub.db`) |
| API | Flask (Python) — small, fits existing Pi stack |
| Frontend | `apps/chores.html` (full page) + summary card on `apps/home-hub.html` |

---

## Data Model

### Table: `chores`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `name` | TEXT | e.g. "Change cat water filter" |
| `frequency_days` | INTEGER | e.g. 30 for monthly |
| `created_at` | DATETIME | |

### Table: `completions`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `chore_id` | INTEGER FK | references `chores.id` |
| `user_id` | INTEGER FK | references `users.id` |
| `completed_at` | DATETIME | |

### Table: `users`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `name` | TEXT | e.g. "Seth", "Elise" |
| `active` | BOOLEAN | soft delete — deactivating hides from dropdowns but preserves history |

---

## Due Date Logic
- Due date = `last_completed_at + frequency_days`
- If never completed: due date = `chore.created_at + frequency_days`
- Status thresholds:
  - **Normal:** due date is in the future (tomorrow or later)
  - **Warning:** due date is today
  - **Danger:** due date has passed

---

## API Endpoints (Flask)

| Method | Route | Description |
|---|---|---|
| GET | `/api/chores` | All chores with current status (due date, days remaining, last completed by) |
| POST | `/api/chores` | Create a chore `{name, frequency_days}` |
| PUT | `/api/chores/<id>` | Edit a chore |
| DELETE | `/api/chores/<id>` | Delete a chore (and its completions) |
| POST | `/api/chores/<id>/complete` | Mark complete `{user_id}` |
| GET | `/api/chores/<id>/history` | Completion history for a chore |
| GET | `/api/users` | All active users |
| POST | `/api/users` | Add a user `{name}` |
| PUT | `/api/users/<id>` | Edit or deactivate a user |

---

## UI — `apps/chores.html` (Full Page)

### Chore List
- Sorted: overdue (red) first → yellow → green
- Each chore card shows:
  - Chore name
  - Status color indicator (consistent with HomeHub design system)
  - Days overdue or days remaining
  - Last completed: "[Name] — [date]" or "Never"
  - "Mark Complete" button → opens user picker dropdown, then confirms
- "Add Chore" button → inline form: name + frequency in days

### Manage Section (collapsible)
- Chore list with edit/delete controls
- User list with add/deactivate controls

### History Drawer (per chore)
- Tappable chore name opens a drawer/modal
- Shows full completion log: user + timestamp, newest first

---

## UI — Summary Card on `apps/home-hub.html`

- Shows top 3–5 chores sorted by urgency (same sort logic as full page)
- Each row: color dot, chore name, days overdue/remaining
- "View All" link → navigates to `apps/chores.html`
- No interaction on the summary card — view only

---

## Design System Compliance
- Follows HomeHub project design system (fonts, colors, light/dark mode)
- Status states use project-standard normal/warning/danger semantic colors
- No external runtime browser requests
- No credentials in repo — DB path configurable via env var