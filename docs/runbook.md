# HomeHub Runbook

Reference for the three scenarios you'll actually encounter.

---

## 1. After a normal shutdown / restart

Power the Pi on and wait ~30 seconds. Then open `https://homehub.local` — done.

**Nothing else needed.** Docker Compose and the systemd timers all auto-start at boot.

Verify if you want to be sure:
```bash
ssh sethpthomas91@homehub.local
docker compose -f /var/www/homehub/docker-compose.yml ps
systemctl status system_stats.timer
systemctl status sensors.timer
```

Both containers (`nginx` and `api`) should show `running`. The timers should show `active`.

---

## 2. Redeploy after code changes

Run from your dev machine:
```bash
git pull                  # get latest from repo
./scripts/deploy.sh       # rsync apps/ + backend/ + configs to Pi, rebuilds containers
```

No Pi SSH needed. The deploy script runs `docker compose up -d --build` on the Pi automatically.

---

## 3. Fresh Pi setup (after re-flashing the SD card)

Do this once per Pi. Steps are ordered — don't skip ahead.

### On the Pi (one-time prerequisites)
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker sethpthomas91
# Log out and back in so the group change takes effect
```

### On your dev machine (one-time SSH key setup)
```bash
ssh-copy-id sethpthomas91@homehub.local
```

### Generate the self-signed TLS certificate (one-time, on the Pi)
```bash
ssh sethpthomas91@homehub.local
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/homehub.key \
  -out /etc/ssl/certs/homehub.crt \
  -subj "/CN=homehub.local" \
  -addext "subjectAltName=DNS:homehub.local"
```

The cert is valid for 10 years. Browsers will show a "not trusted" warning (expected for self-signed) — click through or add the cert to your OS trust store to suppress it.

### Deploy and configure
```bash
# From dev machine:
./scripts/deploy.sh

# SSH to Pi — run one-time setup scripts:
ssh sethpthomas91@homehub.local
bash /var/www/homehub/scripts/setup_system_stats.sh
bash /var/www/homehub/scripts/setup_sensors.sh
bash /var/www/homehub/scripts/setup_chores.sh   # stops native nginx, starts Docker stack
```

Each setup script is idempotent — safe to re-run if anything went wrong.

### Verify
```bash
# Containers up
docker compose -f /var/www/homehub/docker-compose.yml ps

# Systemd timers running
systemctl status system_stats.timer
systemctl status sensors.timer

# Static API files being written
cat /var/www/homehub/api/system.json
cat /var/www/homehub/api/sensors.json

# Chores API responding
curl -k https://localhost/api/chores
curl -k https://localhost/api/users
```

Then open `https://homehub.local` and confirm the dashboard loads with live sensor, weather, and system data. Open `/chores.html` to confirm the chores API is reachable. Browsers will show a self-signed cert warning — proceed past it or trust the cert.

---

## 4. Chores API — first-time data setup

After fresh Pi setup, add your household members and first chores:

```bash
# Add users
curl -k -X POST https://homehub.local/api/users \
  -H 'Content-Type: application/json' -d '{"name":"Seth"}'
curl -k -X POST https://homehub.local/api/users \
  -H 'Content-Type: application/json' -d '{"name":"Elise"}'

# Add chores (name + how many days between completions)
curl -k -X POST https://homehub.local/api/chores \
  -H 'Content-Type: application/json' -d '{"name":"Change cat water filter","frequency_days":30}'
```

Or just use the UI at `https://homehub.local/chores.html` — the Add Chore form and Manage section handle everything.

---

## Troubleshooting

**Containers not starting:**
```bash
ssh sethpthomas91@homehub.local
docker compose -f /var/www/homehub/docker-compose.yml logs
```

**Chores API returning 502:**
The `api` container may still be building. Wait 30 seconds and retry, or check logs above.

**Sensor/weather data missing:**
Systemd timers write to `/var/www/homehub/api/` — check the timer status and that the files exist:
```bash
systemctl status sensors.timer
ls /var/www/homehub/api/
```
