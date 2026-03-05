#!/bin/bash
# ─────────────────────────────────────────────
# HomeHub Deploy Script
# Pushes the dashboard to the Pi over SSH/SCP
# Usage: ./deploy.sh
# ─────────────────────────────────────────────

PI_USER="sethpthomas91"
PI_HOST="homehub.local"
DASHBOARD_SRC="./dashboard/home-hub.html"
DASHBOARD_DEST="/var/www/html/index.html"

echo "→ Deploying HomeHub dashboard to $PI_HOST..."

# Check the source file exists
if [ ! -f "$DASHBOARD_SRC" ]; then
  echo "✗ Error: $DASHBOARD_SRC not found. Run this script from the repo root."
  exit 1
fi

# Copy the file to a temp location (no sudo needed for scp)
scp "$DASHBOARD_SRC" "$PI_USER@$PI_HOST:/tmp/home-hub.html"

if [ $? -ne 0 ]; then
  echo "✗ SCP failed. Is the Pi reachable at $PI_HOST?"
  exit 1
fi

# Move into place with correct ownership
ssh "$PI_USER@$PI_HOST" "sudo cp /tmp/home-hub.html $DASHBOARD_DEST && sudo chown www-data:www-data $DASHBOARD_DEST"

if [ $? -ne 0 ]; then
  echo "✗ Remote copy failed."
  exit 1
fi

echo "✓ Deployed. Open http://$PI_HOST in your browser."