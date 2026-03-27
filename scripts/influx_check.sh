#!/bin/bash
# Usage: influx_check.sh [temp|humid|count|status|sensors]
# Default (no args): shows latest reading per entity

DB="homehub"

cmd="${1:-latest}"

case "$cmd" in
  temp)
    echo "=== Temperature (last 10) ==="
    influx -database "$DB" -execute "SELECT time,entity_id,value FROM sensor WHERE device_class_str='temperature' ORDER BY time DESC LIMIT 10"
    ;;
  humid)
    echo "=== Humidity (last 10) ==="
    influx -database "$DB" -execute "SELECT time,entity_id,value FROM sensor WHERE device_class_str='humidity' ORDER BY time DESC LIMIT 10"
    ;;
  count)
    echo "=== Total readings stored ==="
    influx -database "$DB" -execute "SELECT COUNT(value) FROM sensor"
    ;;
  sensors)
    echo "=== Known sensors ==="
    influx -database "$DB" -execute "SHOW TAG VALUES FROM sensor WITH KEY = entity_id"
    ;;
  status)
    echo "=== InfluxDB service ==="
    systemctl is-active influxdb && echo "influxdb: running" || echo "influxdb: NOT running"
    echo ""
    echo "=== Databases ==="
    influx -execute 'SHOW DATABASES'
    echo ""
    echo "=== Measurements ==="
    influx -database "$DB" -execute 'SHOW MEASUREMENTS'
    ;;
  latest|*)
    echo "=== Latest temperature ==="
    influx -database "$DB" -execute "SELECT time,entity_id,value FROM sensor WHERE device_class_str='temperature' ORDER BY time DESC LIMIT 1"
    echo ""
    echo "=== Latest humidity ==="
    influx -database "$DB" -execute "SELECT time,entity_id,value FROM sensor WHERE device_class_str='humidity' ORDER BY time DESC LIMIT 1"
    ;;
esac
