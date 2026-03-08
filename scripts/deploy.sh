#!/bin/bash
# ─────────────────────────────────────────────
# HomeHub Deploy Script
# Pushes all apps and nginx config to the Pi over SSH
# Usage: ./scripts/deploy.sh
# ─────────────────────────────────────────────

# ── Configure these for your environment ──────────────────
PI_USER="sethpthomas91"
PI_HOST="homehub.local"
WEB_ROOT="/var/www/homehub"
NGINX_CONF="nginx/homehub.conf"

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

# Ensure web root exists on the Pi
ssh "$PI_USER@$PI_HOST" "sudo mkdir -p $WEB_ROOT/apps && sudo chown -R $PI_USER $WEB_ROOT/apps"

# Sync all apps to the Pi
rsync -az --delete apps/ "$PI_USER@$PI_HOST:$WEB_ROOT/apps/"

if [ $? -ne 0 ]; then
  echo "✗ rsync failed. Is the Pi reachable at $PI_HOST?"
  exit 1
fi

# Sync scripts to the Pi
ssh "$PI_USER@$PI_HOST" "sudo mkdir -p $WEB_ROOT/scripts && sudo chown -R $PI_USER $WEB_ROOT/scripts"
rsync -az scripts/ "$PI_USER@$PI_HOST:$WEB_ROOT/scripts/"
ssh "$PI_USER@$PI_HOST" "chmod +x $WEB_ROOT/scripts/*.sh"

# Install nginx config and reload
scp "$NGINX_CONF" "$PI_USER@$PI_HOST:/tmp/homehub.conf"

ssh "$PI_USER@$PI_HOST" "
  sudo cp /tmp/homehub.conf /etc/nginx/sites-available/homehub.conf &&
  sudo ln -sf /etc/nginx/sites-available/homehub.conf /etc/nginx/sites-enabled/homehub.conf &&
  sudo chown -R www-data:www-data $WEB_ROOT &&
  sudo nginx -t && sudo systemctl reload nginx
"

if [ $? -ne 0 ]; then
  echo "✗ Nginx config or reload failed."
  exit 1
fi

echo "✓ Deployed. Open http://$PI_HOST in your browser."
