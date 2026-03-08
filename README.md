# HomeHub

Self-hosted home environment monitoring and apps. Runs on a Raspberry Pi. All data stays local.

**Measures:** Temperature · Humidity · CO₂ (planned)

## Stack
- **Home Assistant** + **ESPHome** — sensor collection
- **InfluxDB** — time-series data storage
- **Mosquitto** — MQTT broker
- **apps/dashboard/** — custom HTML dashboard
- **apps/games/** — games hub (in progress)

## Repo Structure
```
homehub/
├── apps/
│   ├── dashboard/
│   │   ├── home-hub.html       # Markup + imports only
│   │   ├── fonts.css           # Self-hosted font declarations
│   │   ├── three.min.js        # Three.js (self-hosted)
│   │   ├── fonts/              # WOFF2 font files
│   │   ├── css/
│   │   │   ├── theme.css       # CSS custom properties (swap to retheme)
│   │   │   ├── layout.css      # Grid, panels, responsive breakpoints
│   │   │   └── components.css  # Sensor cards, gauges, alerts, charts
│   │   └── js/
│   │       ├── api.js          # Data contract + simulated adapter
│   │       ├── scene3d.js      # Three.js scene and animation loop
│   │       ├── history.js      # Chart rendering + localStorage logging
│   │       └── dashboard.js    # Panels, alerts, tabs, clock, insights
│   └── games/
│       ├── index.html          # Games hub placeholder
│       └── puzzles/            # Puzzle games (in progress)
├── nginx/
│   └── homehub.conf            # Nginx site config
├── esphome/
│   └── *.yaml                  # One config per sensor node
├── docs/
│   └── sensor-guide.md         # Hardware build guide
├── scripts/
│   ├── deploy.sh               # Rsync to Pi
│   ├── preview.py              # Local preview server (mirrors Nginx routing)
│   ├── system_stats.sh         # Writes /api/system.json (run by systemd timer)
│   ├── system_stats.service    # systemd service unit
│   ├── system_stats.timer      # systemd timer unit (every 30s)
│   └── setup_system_stats.sh   # One-time Pi setup for the stats timer
├── secrets.example.yaml        # Copy to secrets.yaml, never commit secrets.yaml
└── README.md
```

## Setup

### Secrets
```bash
cp secrets.example.yaml secrets.yaml
# Edit secrets.yaml with your real values
```

### ESPHome sensors
See `docs/sensor-guide.md` for full build and flashing instructions.

### Dashboard
Served by Nginx at `http://homehub.local`.
Deploy with `./scripts/deploy.sh`.

## Local Preview

Before deploying, verify changes in the browser locally:

```bash
python3 scripts/preview.py        # opens http://localhost:8080
python3 scripts/preview.py 9000   # custom port
```

Mirrors the Nginx routing — `/` serves the dashboard, `/games` serves the games hub. No install required (stdlib only). Ctrl+C to stop.

## Deploy

<!-- Edit the config block at the top of scripts/deploy.sh for your environment before first use -->
```bash
./scripts/deploy.sh
```

### Pi system stats (one-time setup after first deploy)

`/api/system.json` is served by Nginx from `/var/www/homehub/api/` (not in repo — written by systemd timer).
After deploying, SSH to the Pi and run the setup script once:

```bash
ssh sethpthomas91@homehub.local
./scripts/setup_system_stats.sh
```

This installs the systemd timer that writes real CPU%, temperature, RAM, and uptime every 30 seconds.
Until setup runs, the System tab shows `--` for all Pi metrics.

## Privacy
No data leaves the local network. See project docs for full containment rules.
