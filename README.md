# HomeHub

Self-hosted home environment monitoring. Runs on a Raspberry Pi. All data stays local.

**Measures:** Temperature · Humidity · CO₂ (planned)

## Stack
- **Home Assistant** + **ESPHome** — sensor collection
- **InfluxDB** — time-series data storage
- **Mosquitto** — MQTT broker
- **dashboard/** — custom HTML dashboard (swappable)

## Repo Structure
```
homehub/
├── dashboard/
│   ├── home-hub.html       # Main dashboard
│   └── api.js              # HA API abstraction (in progress)
├── esphome/
│   └── *.yaml              # One config per sensor node
├── docs/
│   └── sensor-guide.md     # Hardware build guide
├── secrets.example.yaml    # Copy to secrets.yaml, never commit secrets.yaml
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
Open `dashboard/home-hub.html` in a browser on your local network.
Configure your HA URL and token in `secrets.yaml` (used by `api.js`).

## Deploy

<!-- Edit the config block at the top of scripts/deploy.sh for your environment before first use -->
```bash
./scripts/deploy.sh
```

## Privacy
No data leaves the local network. See project docs for full containment rules.