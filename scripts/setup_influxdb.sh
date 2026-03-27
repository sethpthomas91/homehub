#!/bin/bash
set -e

DB_NAME="homehub"

# NOTE: On Raspberry Pi OS Bookworm (Debian 12), the influxdb package may not be
# available in the default apt repos. If the install step fails, add the InfluxData
# apt repo first:
#   curl https://repos.influxdata.com/influxdata-archive_compat.key | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg
#   echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg] https://repos.influxdata.com/debian stable main' | sudo tee /etc/apt/sources.list.d/influxdata.list
# Then re-run this script.

echo "→ Installing InfluxDB..."
sudo apt-get update -qq
sudo apt-get install -y influxdb influxdb-client
sudo systemctl enable --now influxdb
sleep 3

echo "→ Creating database: $DB_NAME"
influx -execute "CREATE DATABASE $DB_NAME"
influx -execute "SHOW DATABASES"

echo ""
echo "✓ Done."
echo "  Next: add scripts/ha_influxdb.yaml snippet to HA configuration.yaml and restart HA."
echo "  HA config path (typical): /config/configuration.yaml"
