#!/bin/bash
SCRIPTS_DIR=/var/www/homehub/scripts
cp "$SCRIPTS_DIR/weather.service" /etc/systemd/system/
cp "$SCRIPTS_DIR/weather.timer"   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now weather.timer
systemctl start weather.service
