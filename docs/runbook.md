# HomeHub Runbook

Reference for the three scenarios you'll actually encounter.

---

## 1. After a normal shutdown / restart

Power the Pi on and wait ~30 seconds. Then open `http://homehub.local` — done.

**Nothing else needed.** Nginx and the system stats timer both auto-start at boot.

Verify if you want to be sure:
```bash
ssh sethpthomas91@homehub.local
systemctl status nginx
systemctl status system_stats.timer
```

Both should show `active (running)`.

---

## 2. Redeploy after code changes

Run from your dev machine:
```bash
git pull                  # get latest from repo
./scripts/deploy.sh       # rsync apps/ + scripts/ + nginx config to Pi
```

No Pi SSH needed unless it's a first deploy after a fresh OS install (see section 3).

---

## 3. Fresh Pi setup (after re-flashing the SD card)

Do this once per Pi. Steps are ordered — don't skip ahead.

### On the Pi (one-time prerequisites)
```bash
sudo apt update && sudo apt install -y nginx
sudo systemctl enable nginx
```

### On your dev machine (one-time SSH key setup)
```bash
ssh-copy-id sethpthomas91@homehub.local
```

### Deploy and configure
```bash
# From dev machine:
./scripts/deploy.sh

# SSH to Pi:
ssh sethpthomas91@homehub.local
/var/www/homehub/scripts/setup_system_stats.sh
```

The setup script is idempotent — safe to re-run if anything went wrong.

### Verify
```bash
systemctl status system_stats.timer
cat /var/www/homehub/api/system.json
```

Then open `http://homehub.local` and confirm the System tab shows live CPU, temperature, RAM, and uptime values.
