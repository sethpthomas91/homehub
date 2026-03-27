#!/bin/bash
# Usage: ./scripts/new-sensor.sh "living-room"
# Generates esphome/<room>-sensor.yaml from the template

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <room-slug>"
  echo "  Examples: $0 living-room"
  echo "            $0 office"
  echo "            $0 master-bedroom"
  exit 1
fi

ROOM_SLUG="$1"
NODE_NAME="${ROOM_SLUG}-sensor"
OUTFILE="esphome/${NODE_NAME}.yaml"

# Convert slug to title case for friendly name (living-room -> Living Room)
FRIENDLY_NAME=$(echo "$ROOM_SLUG" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')
SENSOR_FRIENDLY="${FRIENDLY_NAME} Sensor"

if [ -f "$OUTFILE" ]; then
  echo "Already exists: $OUTFILE"
  exit 1
fi

sed \
  -e "s/node_name: living-room-sensor/node_name: ${NODE_NAME}/" \
  -e "s/friendly_name: Living Room Sensor/friendly_name: ${SENSOR_FRIENDLY}/" \
  -e "s/room_name: Living Room/room_name: ${FRIENDLY_NAME}/" \
  esphome/sensor-node.yaml > "$OUTFILE"

echo "Created: $OUTFILE"
echo "Copy it to the ESPHome dashboard at http://homehub.local:6052"
