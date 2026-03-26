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

## ESPHome Setup (one-time, on the Pi)

ESPHome runs as a Home Assistant add-on. If HA is already installed on the Pi, this is the fastest path.

### 1. Install the ESPHome add-on

In Home Assistant:
- Go to **Settings → Add-ons → Add-on Store**
- Search for **ESPHome**
- Click **Install**, then **Start**
- Enable **Show in sidebar** for easy access

### 2. Create the secrets file

ESPHome uses its own `secrets.yaml` for WiFi credentials. In the ESPHome dashboard, open the editor and create or edit `secrets.yaml`:

```yaml
wifi_ssid: "YourNetworkName"
wifi_password: "YourWiFiPassword"
```

This file is not synced to GitHub — keep it on the Pi only.

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

The first flash must be done over USB since the device has no firmware yet.

1. Plug the ESP32 into your Mac via USB-C.
2. In the ESPHome dashboard, open the device config and click **Install**.
3. Choose **Plug into this computer** (if running ESPHome locally) or **Manual download** then flash via the ESPHome Web tool at `web.esphome.io`.
4. Select the correct COM/serial port and flash.

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
