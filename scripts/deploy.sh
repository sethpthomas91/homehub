#!/bin/bash
# ─────────────────────────────────────────────
# HomeHub Deploy Script
# Pushes the dashboard to the Pi over SSH/SCP
# Usage: ./deploy.sh
# ─────────────────────────────────────────────

PI_USER="sethpthomas91"
PI_HOST="homehub.local"
DASHBOARD_DEST="/var/www/html/index.html"

echo "→ Deploying HomeHub dashboard to $PI_HOST..."

# Check source files exist
if [ ! -f "./dashboard/home-hub.html" ]; then
  echo "✗ Error: dashboard/home-hub.html not found. Run this script from the repo root."
  exit 1
fi

if [ ! -f "./dashboard/fonts.css" ]; then
  echo "✗ Error: dashboard/fonts.css not found. Run this script from the repo root."
  exit 1
fi

# Sync all dashboard assets to a staging dir on the Pi
rsync -az \
  dashboard/home-hub.html \
  dashboard/fonts.css \
  dashboard/fonts \
  dashboard/three.min.js \
  "$PI_USER@$PI_HOST:/tmp/homehub-deploy/"

if [ $? -ne 0 ]; then
  echo "✗ rsync failed. Is the Pi reachable at $PI_HOST?"
  exit 1
fi

# Move into place with correct ownership
ssh "$PI_USER@$PI_HOST" "
  sudo cp /tmp/homehub-deploy/home-hub.html $DASHBOARD_DEST &&
  sudo cp /tmp/homehub-deploy/fonts.css /var/www/html/fonts.css &&
  sudo cp -r /tmp/homehub-deploy/fonts /var/www/html/fonts &&
  sudo cp /tmp/homehub-deploy/three.min.js /var/www/html/three.min.js &&
  sudo chown -R www-data:www-data $DASHBOARD_DEST /var/www/html/fonts.css /var/www/html/fonts /var/www/html/three.min.js
"

if [ $? -ne 0 ]; then
  echo "✗ Remote copy failed."
  exit 1
fi

echo "✓ Deployed. Open http://$PI_HOST in your browser."