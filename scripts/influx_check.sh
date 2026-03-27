#!/bin/bash
# Usage: influx_check.sh [temp|humid|count|status]
# Default (no args): shows latest temp + humid readings

DB="homehub"

cmd="${1:-latest}"

case "$cmd" in
  temp)
    echo "=== Temperature (last 10) ==="
    influx -database "$DB" -execute 'SELECT time,value FROM "°F" ORDER BY time DESC LIMIT 10'
    ;;
  humid)
    echo "=== Humidity (last 10) ==="
    influx -database "$DB" -execute 'SELECT time,value FROM "%" ORDER BY time DESC LIMIT 10'
    ;;
  count)
    echo "=== Total readings stored ==="
    influx -database "$DB" -execute 'SELECT COUNT(value) FROM "°F"'
    influx -database "$DB" -execute 'SELECT COUNT(value) FROM "%"'
    ;;
  status)
    echo "=== InfluxDB service ==="
    systemctl is-active influxdb && echo "influxdb: running" || echo "influxdb: NOT running"
    echo ""
    echo "=== Databases ==="
    influx -execute 'SHOW DATABASES'
    echo ""
    echo "=== Measurements in homehub ==="
    influx -database "$DB" -execute 'SHOW MEASUREMENTS'
    ;;
  latest|*)
    echo "=== Latest readings ==="
    influx -database "$DB" -execute 'SELECT time,value FROM "°F" ORDER BY time DESC LIMIT 1'
    influx -database "$DB" -execute 'SELECT time,value FROM "%" ORDER BY time DESC LIMIT 1'
    ;;
esac
