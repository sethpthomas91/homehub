#!/bin/bash
# ─────────────────────────────────────────────
# JoviesOverlook Deploy Script
# Pushes all apps and nginx config to the Pi over SSH
# Usage: ./scripts/deploy.sh
# ─────────────────────────────────────────────

PI_USER="sethpthomas91"
PI_HOST="joviesoverlook.local"
WEB_ROOT="/var/www/joviesoverlook"
NGINX_CONF="nginx/joviesoverlook.conf"

echo "→ Deploying to $PI_HOST..."

# Check source assets exist
if [ ! -d "./apps" ]; then
  echo "✗ Error: apps/ directory not found. Run this script from the repo root."
  exit 1
fi

if [ ! -f "./$NGINX_CONF" ]; then
  echo "✗ Error: $NGINX_CONF not found. Run this script from the repo root."
  exit 1
fi

# Sync all apps to the Pi
rsync -az --delete apps/ "$PI_USER@$PI_HOST:$WEB_ROOT/apps/"

if [ $? -ne 0 ]; then
  echo "✗ rsync failed. Is the Pi reachable at $PI_HOST?"
  exit 1
fi

# Install nginx config and reload
scp "$NGINX_CONF" "$PI_USER@$PI_HOST:/tmp/joviesoverlook.conf"

ssh "$PI_USER@$PI_HOST" "
  sudo cp /tmp/joviesoverlook.conf /etc/nginx/sites-available/joviesoverlook.conf &&
  sudo ln -sf /etc/nginx/sites-available/joviesoverlook.conf /etc/nginx/sites-enabled/joviesoverlook.conf &&
  sudo chown -R www-data:www-data $WEB_ROOT &&
  sudo nginx -t && sudo systemctl reload nginx
"

if [ $? -ne 0 ]; then
  echo "✗ Nginx config or reload failed."
  exit 1
fi

echo "✓ Deployed. Open http://$PI_HOST in your browser."
