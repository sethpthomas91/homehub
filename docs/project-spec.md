
# HomeHub Project — Master Document
> Last updated: 2026-03-27 | Status: **Active — Phase 1** | Scripts: `preview.py` (local dev), `deploy.sh` (Pi deploy), `system_stats.sh` (Pi systemd timer), `fetch_weather.sh` (Pi systemd timer, every 15 min), `fetch_sensors.sh` (Pi systemd timer, every 60s), `sensors_status.sh` (Mac → Pi InfluxDB inspector)
> Hardware: ESP32 + DHT22 delivered, first sensor active (office) | Repo: GitHub Private

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
- [x] `home-hub.html` — minimal weather landing page (current conditions + forecast); `system.html` for Pi stats (CPU, temp, RAM, uptime)
- [x] ESP32 + DHT22 sensor build guide written (`docs/sensor-guide.md`)
- [x] ESPHome config defined for temp/humid sensors
- [x] Moved `home-hub.html` into Git repository and defined folder/repo structure (PRs #2–#6)
- [x] Design system migration: warm earth-tone palette, light mode default, `css/tokens.css` created, Three.js removed, all token names updated across dashboard and games pages
- [x] Landing page rewrite + weather cache: replaced sensor dashboard with minimal weather landing page; Open-Meteo data cached on Pi every 15 min via `fetch_weather.sh` + systemd timer; browser fetches `/api/weather.json` only — no external runtime calls; dead JS/CSS modules + Three.js removed; standalone `system.html` for Pi stats (CPU, temp, RAM, uptime); `deploy.sh` fixed to create `api/` dir on Pi
- [x] Pill nav + house dashboard: pill nav on landing page (Weather active, House links to `/house.html`); `house.html` with Cabin section, 4 room cards (Office live, others empty); 2→3-column responsive grid; shared topbar + footer pattern
- [x] Fix `/house` download bug: changed pill href to `/house.html` (extension-explicit URL); reverted nginx `try_files` to clean `$uri $uri/ =404`; removed `FILE_ROUTES` workaround from `preview.py` (PR #23, PR #24)
- [x] Live sensor data pipeline: `fetch_sensors.sh` polls HA REST API → `/api/sensors.json` (values rounded to nearest integer); sensors.service + sensors.timer (60s); `house.html` replaced hardcoded data with `fetchSensors()` live fetch + 70s poll; `setup_sensors.sh` one-time Pi installer; ESPHome °F filter added to `office-sensor.yaml`; Office, Living room, and Bedroom sensors confirmed live
- [x] InfluxDB setup: `setup_influxdb.sh` installs InfluxDB 1.x and creates `homehub` database; `ha_influxdb.yaml` bootstraps HA integration (HA auto-migrates to UI config — remove YAML after restart); UI config has no entity filtering so all numeric entities are logged — intentional, all data kept for long-term history; "Enable newly added entities" ON so new sensors log automatically; YAML support removed in HA 2026.9.0, no action needed before then
- [x] InfluxDB inspector: `influx_check.sh` (on Pi) + `sensors_status.sh` (Mac wrapper) — check latest readings, history, counts, and service health without manual SSH

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
| **No external requests at runtime** | Dashboard must not call any external URLs (Google Fonts, CDNs, etc.) when running. All assets self-hosted. |
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
| ✅ Install InfluxDB on Raspberry Pi | Client | `setup_influxdb.sh` — run on Pi |
| ✅ Configure HA → InfluxDB integration | Client | `ha_influxdb.yaml` snippet — paste into HA config, HA auto-migrates to UI, remove YAML after |
| Build first 2–3 ESP32 + DHT22 sensors | Client | **Hardware delivered — in progress** |
| Mount sensors, confirm live readings in HA | Client | |
| ✅ Add Pi system stats (CPU/RAM/temp/uptime) — shell script + systemd timer | Dev | `system_stats.sh` writes `/api/system.json` every 30s; dashboard polls it; run `setup_system_stats.sh` on Pi after first deploy |
| ✅ Build sensor dashboard and HA REST adapter | Dev | `fetch_sensors.sh` + `house.html` live fetch (B-1) |
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

| # | Issue | Priority | Notes |
|---|-------|----------|-------|
| ~~B-1~~ | ~~Sensor data display~~ | ~~High~~ | ✅ Resolved — `fetch_sensors.sh` + `house.html` live fetch |
| ~~B-2~~ | ~~No persistent logging — InfluxDB not yet installed~~ | ~~High~~ | ✅ Resolved — `setup_influxdb.sh` + `ha_influxdb.yaml` |
| B-3 | Shed sensor: DHT22 may underperform in wide temp swings — consider BME280 | Medium | |
| B-4 | No outdoor temp/humid sensor — thermal delta calculations not yet possible | Medium | Was estimated in old dashboard; feature removed in PR #19 |
| B-5 | CO₂ sensors not yet ordered or installed | Medium | |
| B-6 | Solar monitoring — sensors not installed, no UI | Low | Solar tab removed in PR #19 |
| B-7 | No auth on dashboard — fine for local network, note for future | Low | |

---

## Sensor Inventory

| Sensor | Location | Status | Hardware |
|--------|----------|--------|----------|
| ESP32 + DHT22 | Living Room | **Active** | GPIO16 |
| ESP32 + DHT22 | Kitchen | **Planned** | |
| ESP32 + DHT22 | Master Bedroom | **Active** | GPIO16 |
| ESP32 + DHT22 | Office | **Active** | GPIO16, right side pin 12 |
| ESP32 + DHT22 | Shed | **Planned** | Consider BME280 instead |
| ESP32 + DHT22 | Tenant Room | **Planned** | |
| ESP32 + MH-Z19B | Master Bedroom | **Phase 2** | |
| ESP32 + MH-Z19B | Great Room | **Phase 2** | |
| ESP32 + MH-Z19B | Office | **Phase 2** | |
| ESP32 + DHT22 | Outdoor | **Phase 1 — priority** | |

---

## Reference Links

- ESPHome docs: https://esphome.io
- Home Assistant: http://homehub.local:8123
- Sensor build guide: `docs/sensor-guide.md`
- Dashboard: `home-hub.html`
- InfluxDB: https://docs.influxdata.com/influxdb/v2/
- CP2102 driver: Silicon Labs (search "CP2102 Silicon Labs driver")

---

*This document is the source of truth. Update it as decisions are made and tasks completed.*
