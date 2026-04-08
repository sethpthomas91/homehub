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

# Build puzzles.js if manifest.json exists
if [ -f "./apps/games/puzzles/manifest.json" ]; then
  echo "→ Building puzzles.js from manifest..."
  node scripts/puz-to-js.js
  if [ $? -ne 0 ]; then
    echo "✗ puz-to-js.js failed. Fix errors above before deploying."
    exit 1
  fi
else
  echo "⚠  No manifest.json found — skipping puzzle build (puzzles.js not updated)"
fi

if [ ! -f "./$NGINX_CONF" ]; then
  echo "✗ Error: $NGINX_CONF not found. Run this script from the repo root."
  exit 1
fi

# Ensure all required directories exist on the Pi
ssh "$PI_USER@$PI_HOST" "sudo mkdir -p $WEB_ROOT/apps $WEB_ROOT/api $WEB_ROOT/backend $WEB_ROOT/nginx && sudo chown -R $PI_USER $WEB_ROOT"

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

# Sync Flask backend source
rsync -az backend/ "$PI_USER@$PI_HOST:$WEB_ROOT/backend/"

# Sync docker-compose.yml and nginx config
scp docker-compose.yml "$PI_USER@$PI_HOST:$WEB_ROOT/docker-compose.yml"
scp "$NGINX_CONF" "$PI_USER@$PI_HOST:$WEB_ROOT/nginx/homehub.conf"

# Rebuild and restart Docker Compose stack
ssh "$PI_USER@$PI_HOST" "docker compose -f $WEB_ROOT/docker-compose.yml up -d --build"

if [ $? -ne 0 ]; then
  echo "✗ Docker Compose restart failed."
  exit 1
fi

echo "✓ Deployed. Open http://$PI_HOST in your browser."
