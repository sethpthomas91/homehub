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
FONTS_CSS_SRC="./dashboard/fonts.css"
FONTS_DIR_SRC="./dashboard/fonts"
THREE_JS_SRC="./dashboard/three.min.js"

echo "→ Deploying HomeHub dashboard to $PI_HOST..."

# Check source files exist
if [ ! -f "$DASHBOARD_SRC" ]; then
  echo "✗ Error: $DASHBOARD_SRC not found. Run this script from the repo root."
  exit 1
fi

if [ ! -f "$FONTS_CSS_SRC" ]; then
  echo "✗ Error: $FONTS_CSS_SRC not found. Run this script from the repo root."
  exit 1
fi

# Copy the HTML to a temp location (no sudo needed for scp)
scp "$DASHBOARD_SRC" "$PI_USER@$PI_HOST:/tmp/home-hub.html"

if [ $? -ne 0 ]; then
  echo "✗ SCP failed. Is the Pi reachable at $PI_HOST?"
  exit 1
fi

# Copy fonts.css, fonts/ directory, and three.min.js
scp "$FONTS_CSS_SRC" "$PI_USER@$PI_HOST:/tmp/fonts.css"
scp -r "$FONTS_DIR_SRC" "$PI_USER@$PI_HOST:/tmp/fonts"
scp "$THREE_JS_SRC" "$PI_USER@$PI_HOST:/tmp/three.min.js"

if [ $? -ne 0 ]; then
  echo "✗ SCP of assets failed."
  exit 1
fi

# Move everything into place with correct ownership
ssh "$PI_USER@$PI_HOST" "sudo cp /tmp/home-hub.html $DASHBOARD_DEST && sudo cp /tmp/fonts.css /var/www/html/fonts.css && sudo cp -r /tmp/fonts /var/www/html/fonts && sudo cp /tmp/three.min.js /var/www/html/three.min.js && sudo chown -R www-data:www-data /var/www/html/fonts.css /var/www/html/fonts /var/www/html/three.min.js $DASHBOARD_DEST"

if [ $? -ne 0 ]; then
  echo "✗ Remote copy failed."
  exit 1
fi

echo "✓ Deployed. Open http://$PI_HOST in your browser."