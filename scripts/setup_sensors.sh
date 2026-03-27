#!/bin/bash
set -e

SCRIPTS_DIR="/var/www/homehub/scripts"
API_DIR="/var/www/homehub/api"
TOKEN_FILE="/etc/homehub/ha_token"
PI_USER="sethpthomas91"
SYSTEMD_DIR="/etc/systemd/system"

echo "→ Setting up sensor fetch pipeline..."

# Create api dir
mkdir -p "$API_DIR"
chown "$PI_USER" "$API_DIR"

# Ensure script is executable
chmod +x "$SCRIPTS_DIR/fetch_sensors.sh"

# Create HA token file if missing
if [ ! -f "$TOKEN_FILE" ]; then
  echo ""
  echo "No HA token found at $TOKEN_FILE"
  echo "Generate one at: http://homehub.local:8123 → Profile → Long-Lived Access Tokens"
  echo ""
  mkdir -p /etc/homehub
  read -rp "Paste your HA Long-Lived Access Token and press Enter: " ha_token
  echo "$ha_token" | sudo tee "$TOKEN_FILE" > /dev/null
  chown root:"$PI_USER" "$TOKEN_FILE"
  chmod 640 "$TOKEN_FILE"
  echo "✓ Token saved to $TOKEN_FILE"
else
  echo "✓ Token file already exists at $TOKEN_FILE"
fi

# Install systemd units
cp "$SCRIPTS_DIR/sensors.service" "$SYSTEMD_DIR/sensors.service"
cp "$SCRIPTS_DIR/sensors.timer"   "$SYSTEMD_DIR/sensors.timer"

systemctl daemon-reload
systemctl enable --now sensors.timer

# Run once immediately and verify
echo "→ Running fetch_sensors.sh to verify..."
systemctl start sensors.service

if [ -f "$API_DIR/sensors.json" ]; then
  echo "✓ sensors.json written successfully:"
  cat "$API_DIR/sensors.json"
else
  echo "✗ sensors.json not found — check 'journalctl -u sensors.service' for errors"
  exit 1
fi

echo ""
echo "✓ Setup complete. Timer active — sensors refreshed every 60s."
echo "  Verify entity IDs first at: http://homehub.local:8123/developer-tools/state"
echo "  Search 'office' and confirm IDs match those in fetch_sensors.sh."
