#!/bin/bash
# ─────────────────────────────────────────────
# HomeHub Deploy Script
# Pushes the dashboard to the Pi over SSH/SCP
# Usage: ./deploy.sh
# ─────────────────────────────────────────────

# ── Configure these for your environment ──────────────────
PI_USER="sethpthomas91"
PI_HOST="homehub.local"
WEB_ROOT="/var/www/html"
DASHBOARD_DEST="$WEB_ROOT/index.html"
# ──────────────────────────────────────────────────────────

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
  sudo cp /tmp/homehub-deploy/fonts.css $WEB_ROOT/fonts.css &&
  sudo cp -r /tmp/homehub-deploy/fonts $WEB_ROOT/fonts &&
  sudo cp /tmp/homehub-deploy/three.min.js $WEB_ROOT/three.min.js &&
  sudo chown -R www-data:www-data $DASHBOARD_DEST $WEB_ROOT/fonts.css $WEB_ROOT/fonts $WEB_ROOT/three.min.js
"

if [ $? -ne 0 ]; then
  echo "✗ Remote copy failed."
  exit 1
fi

echo "✓ Deployed. Open http://$PI_HOST in your browser."