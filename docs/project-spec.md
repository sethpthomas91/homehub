# HomeHub Project — Master Document
> Last updated: 2026-03-08 | Status: **Active — Phase 1** | Scripts: `preview.py` (local dev), `deploy.sh` (Pi deploy)
> Hardware: ESP32 + DHT22 ordered, awaiting delivery | Repo: GitHub Private

---

## Project Brief

A self-hosted home environment monitoring system running on a Raspberry Pi. The homeowner builds most hardware and software themselves. All data stays local. The system must be modular — sensors, backends, and dashboards can be swapped independently.

**Core measures:** Temperature · Humidity · CO₂ · (expandable)
**Platform:** Raspberry Pi + Home Assistant + ESPHome
**Dashboard:** Decoupled from data layer — swappable

---

## Guiding Principles

| # | Principle | Why it matters |
|---|-----------|---------------|
| 1 | **Local-first, data stays home** | No sensor data, history, or identifiable info leaves the local network under any circumstances |
| 2 | **Backend / frontend separation** | Swap dashboards without touching sensors or data |
| 3 | **Build before buy** | DIY where feasible; off-the-shelf where DIY adds no value |
| 4 | **Export-ready data** | CSV/JSON export for professionals — manual, on request, never automatic |
| 5 | **Modular hardware** | Add/remove sensors without redesigning the system |

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Raspberry Pi                       │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │  Home        │    │  InfluxDB (time-series   │   │
│  │  Assistant   │───▶│  data store)             │   │
│  │  + ESPHome   │    └──────────────────────────┘   │
│  └──────┬───────┘              │                    │
│         │ REST / WS            │ Grafana / custom   │
│         ▼                      ▼   dashboard        │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │  MQTT broker │    │  Dashboard layer         │   │
│  │  (Mosquitto) │    │  (home-hub.html today,   │   │
│  └──────┬───────┘    │   swappable)             │   │
│         │            └──────────────────────────┘   │
└─────────┼───────────────────────────────────────────┘
          │ WiFi (ESP32 → HA)
          │
    ┌─────┴──────────────────────┐
    │  ESP32 sensor nodes        │
    │  DHT22 (temp/humid)        │
    │  MH-Z19B (CO₂) — planned  │
    └────────────────────────────┘
```

**Dashboard is stateless** — it reads from InfluxDB/HA API only. Can be replaced with Grafana, a new HTML file, or a React app without touching anything else.

---

## Current State

### Done
- [x] `home-hub.html` — functional dashboard with modular file structure (Three.js 3D view, sensor cards, history charts, solar tab, insights tab)
- [x] ESP32 + DHT22 sensor build guide written (`sensor-guide.docx`)
- [x] ESPHome config defined for temp/humid sensors
- [x] Room layout modelled in 3D (multi-floor, basement, shed)
- [x] Simulated sensor data driving all UI panels
- [x] Moved `home-hub.html` into Git repository and defined folder/repo structure (PRs #2–#6)
- [x] Dashboard refactored into modular structure: `css/theme.css`, `css/layout.css`, `css/components.css`, `js/api.js` (data contract), `js/scene3d.js`, `js/history.js`, `js/dashboard.js` (PR #13)
- [x] Dashboard code quality pass: `localStorage` fix, interval ID capture, CSS variable extraction, `updateRoom()`/`onRoomsUpdate()` infrastructure, threshold constants centralised (PR #14)

### Not Started
- See Phase roadmap below

---

## Privacy & Data Containment Rules

These are non-negotiable constraints that apply to every phase and every component.

| Rule | Detail |
|------|--------|
| **No sensor data in the repo** | `.gitignore` must exclude any data exports, InfluxDB files, and HA database. Code only. |
| **No credentials in the repo** | WiFi passwords, HA API tokens, InfluxDB credentials go in a `secrets.yaml` / `.env` file that is gitignored. A `secrets.example` file (with placeholder values) is committed instead. |
| **HA analytics off** | Home Assistant's optional analytics/telemetry must be disabled. Verify in Settings → System → General. |
| **InfluxDB not exposed externally** | Bind to `localhost` or the local network interface only. No public port forwarding. |
| **No external requests at runtime** | Dashboard must not call any external URLs (Google Fonts, CDNs, etc.) when running. All assets self-hosted. Current `home-hub.html` loads Google Fonts — this must be fixed before production. |
| **ESP32 nodes talk to local HA only** | ESPHome `api:` config points to local HA instance. No OTA or cloud fallback endpoints. |
| **Data exports are manual and intentional** | No scheduled or automatic export to any destination. Export is a deliberate action by the homeowner. |
| **Pi not exposed to the internet** | No port forwarding on the router for Pi services. Remote access (if ever desired) goes through a VPN like WireGuard, not open ports. |

---

## Phase Roadmap

### Phase 1 — Foundation *(current)*
**Goal:** Real data flowing into the dashboard. No more simulated values.

| Task | Owner | Notes |
|------|-------|-------|
| ✅ Create GitHub private repo, commit `home-hub.html` and sensor guide | Client | https://github.com/sethpthomas91/homehub |
| ✅ Self-host Google Fonts and Three.js | Dev | PR #2 — zero external runtime requests |
| ✅ Passwordless SSH deploy with rsync | Dev | PR #3 — single rsync, no password prompts |
| ✅ Consolidate deploy.sh config block | Dev | PR #4 — all env-specific values in one place |
| ✅ Clean up secrets.example.yaml | Dev | PR #5 — removed accidental chat transcript |
| ✅ Restructure repo for multi-app serving | Dev | PR #6 — apps/, nginx/ in version control, /games placeholder live |
| ✅ Add local preview server | Dev | PR #10 — `scripts/preview.py` mirrors Nginx routing; no deploy needed to preview |
| Install InfluxDB on Raspberry Pi | Client | InfluxDB 2.x recommended |
| Configure HA → InfluxDB integration | Client | Built-in HA integration |
| Build first 2–3 ESP32 + DHT22 sensors | Client | **Waiting on hardware delivery** |
| Mount sensors, confirm live readings in HA | Client | |
| ✅ Refactor dashboard into modular file structure (CSS/JS split) | Dev | PR #13 — `css/`, `js/` dirs; `api.js` data contract; ES modules |
| ✅ Fix dashboard code quality issues | Dev | PR #14 — localStorage fix, interval IDs, CSS variables, `updateRoom()` / `onRoomsUpdate()` hook, threshold constants centralized |
| Write HA REST adapter in `api.js` — replace simulated `rooms[]` with real API call | Dev | Data contract defined; swap `getSensorReadings()` body only; `onRoomsUpdate()` hook ready for Phase 1 polling |
| Add MQTT broker (Mosquitto) to Pi | Client | Enables future Zigbee devices |

**Phase 1 exit criteria:** At least 3 real sensors reporting live to the dashboard. History tab logging real data to InfluxDB.

---

### Phase 2 — Air Quality Layer
**Goal:** CO₂ readings in every main living area.

| Task | Owner | Notes |
|------|-------|-------|
| Order MH-Z19B CO₂ sensors (×3 minimum) | Client | ~$20 each on AliExpress |
| Build CO₂ sensor nodes (ESP32 + MH-Z19B) | Client | Guide to be written |
| Add CO₂ entities to ESPHome configs | Dev | |
| Add CO₂ to dashboard sensor cards and insights | Dev | |
| Define CO₂ alert thresholds | Building Pro | 800ppm watch, 1200ppm act |

**Phase 2 exit criteria:** CO₂ visible in dashboard for Master Bed, Great Room, Office.

---

### Phase 3 — Data Export & Professional Handoff
**Goal:** Any professional (HVAC, building envelope, energy auditor) can receive a data export and use it immediately.

| Task | Owner | Notes |
|------|-------|-------|
| Build CSV export endpoint from InfluxDB | Dev | Date range picker |
| Define standard export schema (timestamp, room, floor, temp, humid, CO₂) | Dev | |
| Document what each column means for non-technical recipients | Client | 1-page explainer |
| Test export with real 30-day dataset | Client | |

---

### Phase 4 — Dashboard Decoupling
**Goal:** `home-hub.html` reads from a stable local API. A second dashboard (e.g. Grafana) can be plugged in at any time.

| Task | Owner | Notes |
|------|-------|-------|
| Define simple REST API spec (HA or thin wrapper) | Dev | `/api/sensors/current`, `/api/sensors/history` |
| Refactor `home-hub.html` to use API, remove all hardcoded room data | Dev | |
| Stand up Grafana instance on Pi as parallel dashboard | Client | For comparison / professionals |
| Document how to add a new dashboard | Dev | README section |

---

### Phase 5 — Solar Monitoring *(low priority, when ready)*
**Goal:** 2 years of real roof irradiance data before first installer quote.

| Task | Owner | Notes |
|------|-------|-------|
| Order VEML7700 (×2), DS18B20, DS3231, anemometer | Client | ~$74 total, see Solar tab shopping list |
| Mount sensors on east and west roof faces | Client | Run wire to attic ESP32 |
| Add Solar entities to HA | Dev | |
| Connect Solar tab to real data | Dev | Currently showing model curves |

---

## Open Decisions

| # | Decision | Options | Status |
|---|----------|---------|--------|
| 1 | Data API layer | ✅ **Direct HA API** with isolated `api.js` abstraction module. Swap the module later without touching dashboard logic. | **Decided** |
| 2 | History backend | InfluxDB vs SQLite vs HA recorder | **Leaning InfluxDB** |
| 3 | Second dashboard | Grafana vs another custom HTML | **Open** |
| 4 | Shed sensor upgrade | DHT22 (current plan) vs BME280 (recommended for shed) | **Leaning BME280** |
| 5 | Repo hosting | ✅ **GitHub Private** | **Decided** |

---

## Team / Roles

| Role | Who | Scope |
|------|-----|-------|
| **Homeowner / Client** | You | Requirements, hardware builds, mounting, testing |
| **Dev** | Claude | Dashboard code, API design, config files |
| **Building Professional** | Claude (advisor mode) | Threshold recommendations, data interpretation, renovation prep |
| **Designer** | Claude (advisor mode) | Dashboard UX, layout decisions |
| **Electronics Guide** | Claude (advisor mode) | Sensor selection, wiring, enclosures |

---

## Known Issues / Backlog

| # | Issue | Priority |
|---|-------|----------|
| B-1 | Dashboard data is fully simulated — needs real HA API connection | **High** |
| B-2 | No persistent logging — InfluxDB not yet installed | **High** |
| B-3 | Shed sensor: DHT22 may underperform in wide temp swings — consider BME280 | Medium |
| B-4 | No outdoor temp/humid sensor — thermal delta calculations are estimated | Medium |
| B-5 | CO₂ sensors not yet ordered or installed | Medium |
| B-6 | Solar tab shows model curves only — sensors not installed | Low |
| B-7 | No auth on dashboard — fine for local network, note for future | Low |

---

## Sensor Inventory

| Sensor | Location | Status | Hardware |
|--------|----------|--------|----------|
| ESP32 + DHT22 | Living Room | **Planned** | Ordered? |
| ESP32 + DHT22 | Kitchen | **Planned** | |
| ESP32 + DHT22 | Master Bedroom | **Planned** | |
| ESP32 + DHT22 | Office | **Planned** | |
| ESP32 + DHT22 | Shed | **Planned** | Consider BME280 instead |
| ESP32 + DHT22 | Tenant Room | **Planned** | |
| ESP32 + MH-Z19B | Master Bedroom | **Phase 2** | |
| ESP32 + MH-Z19B | Great Room | **Phase 2** | |
| ESP32 + MH-Z19B | Office | **Phase 2** | |
| ESP32 + DHT22 | Outdoor | **Phase 1 — priority** | |

---

## Reference Links

- ESPHome docs: https://esphome.io
- Home Assistant: http://homeassistant.local:8123
- Sensor build guide: `sensor-guide.docx`
- Dashboard: `home-hub.html`
- InfluxDB: https://docs.influxdata.com/influxdb/v2/
- CP2102 driver: Silicon Labs (search "CP2102 Silicon Labs driver")

---

*This document is the source of truth. Update it as decisions are made and tasks completed.*
