# ESP32 + DHT22 Sensor Build Guide

How to wire, flash, and connect a temperature/humidity sensor node to Home Assistant via ESPHome.

---

## Parts (per node)

- ESP32 WROOM-32 DevKit (Type-C)
- DHT22 AM2302 module with PCB (3-pin, pull-up resistor built in)
- 100pt breadboard
- 3× dupont cables (female-to-male or male-to-male depending on your board headers)
- USB-C cable + wall adapter

---

## Wiring

The DHT22 PCB module has 3 labeled pins. Connect them to the ESP32 as follows:

| DHT22 Module Pin | ESP32 Pin |
|------------------|-----------|
| VCC              | 3V3       |
| GND              | GND       |
| DAT              | GPIO4     |

**On the breadboard:**
1. Seat the ESP32 across the center divide so both pin rows are accessible.
2. Plug the DHT22 module into free breadboard rows nearby.
3. Run a dupont cable from DHT22 VCC → ESP32 3V3.
4. Run a dupont cable from DHT22 GND → ESP32 GND.
5. Run a dupont cable from DHT22 DAT → ESP32 pin labeled **4** (GPIO4).

> No resistor needed — the PCB module already includes the pull-up resistor on the data line.

---

## Prerequisites

### Step 1 — Install Docker on the Pi

SSH into the Pi, then:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker sethpthomas91
```

Log out and back in so the group change takes effect.

### Step 2 — Install Home Assistant Container

```bash
docker run -d \
  --name homeassistant \
  --restart=unless-stopped \
  --privileged \
  -v /home/sethpthomas91/.homeassistant:/config \
  -e TZ=America/Vancouver \
  --network=host \
  ghcr.io/home-assistant/home-assistant:stable
```

> Adjust `TZ` to your timezone. Full list at https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

HA will be available at `http://homehub.local:8123`. Complete the onboarding wizard (create account, set location, skip any device discovery for now).

> **Note:** HA Container does not support add-ons, so ESPHome runs as a separate container (next step).

### Step 3 — Install ESPHome as a Docker container

```bash
docker run -d \
  --name esphome \
  --restart=unless-stopped \
  -v /home/sethpthomas91/.esphome:/config \
  --network=host \
  ghcr.io/esphome/esphome
```

ESPHome dashboard will be available at `http://homehub.local:6052`.

### Step 4 — Create the ESPHome secrets file

SSH into the Pi and create the secrets file:

```bash
nano /home/sethpthomas91/.esphome/secrets.yaml
```

```yaml
wifi_ssid: "YourNetworkName"
wifi_password: "YourWiFiPassword"
api_encryption_key: "generate-a-32-byte-base64-key-here"
ota_password: "choose-a-password"
fallback_password: "choose-a-fallback-password"
```

To generate an encryption key:
```bash
python3 -c "import base64, os; print(base64.b64encode(os.urandom(32)).decode())"
```

This file stays on the Pi only — never committed to the repo.

---

## ESPHome Device Config

For each new sensor node, create a new config in the ESPHome dashboard (or copy from the template in `esphome/` in this repo).

**Template:** `esphome/sensor-node.yaml`

Key things to change per node:
- `name` — lowercase, hyphens, unique per node (e.g. `living-room-sensor`)
- `friendly_name` — human-readable label shown in HA
- `temperature.name` / `humidity.name` — what shows up as the entity name in HA

---

## Flashing the ESP32

### First flash (via USB)

The first flash must be done over USB. ESPHome is running on the Pi, not your Mac, so use the **Manual Download** method to flash from your Mac's browser.

1. In the ESPHome dashboard (`http://homehub.local:6052`), open the device config and click **Install → Manual download**.
2. ESPHome will compile the firmware and download a `.bin` file to your Mac.
3. Plug the ESP32 into your Mac via USB-C.
4. Open `https://web.esphome.io` in Chrome or Edge (requires a Chromium-based browser).
5. Click **Connect**, select the ESP32's serial port, then click **Install** and select the downloaded `.bin`.

If the serial port doesn't appear, install the CH340 driver first:
```bash
brew install --cask wch-ch34x-usb-serial-driver
```
Then unplug and replug the ESP32.

Once the first flash is complete, all future updates can be done **wirelessly over OTA** — no USB needed.

### Subsequent flashes (OTA)

In the ESPHome dashboard, just click **Install → Wirelessly**. The node must be powered on and connected to WiFi.

---

## Verifying in Home Assistant

1. After flashing, power the ESP32 via USB wall adapter.
2. It will connect to WiFi and appear in HA under **Settings → Devices & Services → ESPHome**.
3. Click **Configure** to add it.
4. The temperature and humidity entities will appear on the device page.

To add readings to the dashboard, use the HA Lovelace editor and add an **Entities** or **Gauge** card pointing to the new entities.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Node not appearing in HA | Wrong WiFi creds or not on same network | Check `secrets.yaml`, confirm 2.4GHz network |
| Sensor shows `unavailable` | Bad wiring or wrong GPIO pin | Re-check DAT → GPIO4 connection |
| Temperature reads -40 or 0 | DHT22 not getting power or data line issue | Confirm VCC → 3V3 (not 5V), reseat cables |
| Flash fails over USB | Wrong serial port or driver missing | Install CH340 driver (Mac: `brew install --cask wch-ch34x-usb-serial-driver`) |

---

## Naming Convention

Name each node by room, lowercase with hyphens:

```
living-room-sensor
kitchen-sensor
master-bedroom-sensor
office-sensor
shed-sensor
tenant-room-sensor
outdoor-sensor
```

The ESPHome config filename should match: `living-room-sensor.yaml`
