#!/bin/bash
# setup_system_stats.sh — one-time setup on the Pi for the system stats timer
# Run once after first deploy: ssh homehub.local then ./scripts/setup_system_stats.sh
# Requires sudo for systemd operations.

set -e

WEB_ROOT="/var/www/homehub"
SCRIPT="$WEB_ROOT/scripts/system_stats.sh"
SERVICE_SRC="$WEB_ROOT/scripts/system_stats.service"
TIMER_SRC="$WEB_ROOT/scripts/system_stats.timer"
PI_USER="sethpthomas91"

echo "→ Creating /api output directory..."
sudo mkdir -p "$WEB_ROOT/api"
sudo chown "$PI_USER" "$WEB_ROOT/api"

echo "→ Making system_stats.sh executable..."
sudo chmod +x "$SCRIPT"

echo "→ Installing systemd units..."
sudo cp "$SERVICE_SRC" /etc/systemd/system/system_stats.service
sudo cp "$TIMER_SRC"   /etc/systemd/system/system_stats.timer

echo "→ Enabling and starting timer..."
sudo systemctl daemon-reload
sudo systemctl enable --now system_stats.timer

echo ""
echo "→ Verification:"
systemctl status system_stats.timer --no-pager
echo ""
echo "→ Waiting 2s for first run..."
sleep 2
if [ -f "$WEB_ROOT/api/system.json" ]; then
  echo "✓ JSON written:"
  cat "$WEB_ROOT/api/system.json"
else
  echo "⚠ JSON not yet written — timer may need a moment. Check:"
  echo "  journalctl -u system_stats.service -n 20"
fi
