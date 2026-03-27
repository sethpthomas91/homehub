#!/bin/bash
# Run from your Mac. Usage: ./scripts/sensors_status.sh [latest|temp|humid|count|status]

ssh sethpthomas91@homehub.local "bash /var/www/homehub/scripts/influx_check.sh ${1:-latest}"
