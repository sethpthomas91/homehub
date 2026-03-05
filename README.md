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
│   │   ├── home-hub.html       # Main dashboard
│   │   ├── fonts.css           # Self-hosted font declarations
│   │   ├── three.min.js        # Three.js (self-hosted)
│   │   └── fonts/              # WOFF2 font files
│   └── games/
│       ├── index.html          # Games hub placeholder
│       └── puzzles/            # Puzzle games (in progress)
├── nginx/
│   └── joviesoverlook.conf     # Nginx site config
├── esphome/
│   └── *.yaml                  # One config per sensor node
├── docs/
│   └── sensor-guide.md         # Hardware build guide
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
Served by Nginx at `http://joviesoverlook.local`.
Deploy with `./scripts/deploy.sh`.

### First-time Pi setup
Before the first deploy, update the Pi hostname:
```bash
sudo hostnamectl set-hostname joviesoverlook
sudo nano /etc/hosts  # replace 'homehub' with 'joviesoverlook'
sudo reboot
```

## Privacy
No data leaves the local network. See project docs for full containment rules.
