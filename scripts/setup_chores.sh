#!/bin/bash
# ─────────────────────────────────────────────
# Chores feature one-time Pi setup
# Run once after deploying the chores feature.
# Usage: bash /var/www/homehub/scripts/setup_chores.sh
# ─────────────────────────────────────────────

WEB_ROOT="/var/www/homehub"
PI_USER="sethpthomas91"

echo "→ Stopping and disabling native nginx (Docker will serve port 80)..."
sudo systemctl stop nginx
sudo systemctl disable nginx

echo "→ Creating SQLite data directory..."
sudo mkdir -p "$WEB_ROOT/data"
sudo chown "$PI_USER" "$WEB_ROOT/data"

echo "→ Starting Docker Compose stack..."
docker compose -f "$WEB_ROOT/docker-compose.yml" up -d --build

echo "✓ Setup complete. Open http://homehub.local in your browser."
