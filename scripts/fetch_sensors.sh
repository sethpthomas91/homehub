#!/bin/bash
set -e

TOKEN_FILE="/etc/homehub/ha_token"
HA_URL="http://localhost:8123"
OUT_DIR="/var/www/homehub/api"
OUT_FILE="$OUT_DIR/sensors.json"
TMP_FILE="$OUT_DIR/.sensors_tmp.json"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "fetch_sensors: token file not found at $TOKEN_FILE" >&2
  exit 1
fi

TOKEN=$(cat "$TOKEN_FILE")

fetch_state() {
  curl -sf --max-time 5 \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "$HA_URL/api/states/$1"
}

temp_json=$(fetch_state "sensor.office_sensor_office_temperature")
humid_json=$(fetch_state "sensor.office_sensor_office_humidity")

temp=$(echo "$temp_json"   | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','null'))")
humid=$(echo "$humid_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','null'))")

if ! echo "$temp"  | grep -qE '^[0-9]+(\.[0-9]+)?$'; then temp="null"; fi
if ! echo "$humid" | grep -qE '^[0-9]+(\.[0-9]+)?$'; then humid="null"; fi

generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p "$OUT_DIR"

cat > "$TMP_FILE" <<EOF
{
  "generated_at": "$generated_at",
  "floors": [
    {
      "name": "Cabin",
      "rooms": [
        { "name": "Office",      "temp": $temp, "humidity": $humid },
        { "name": "Living room", "temp": null,  "humidity": null },
        { "name": "Bedroom",     "temp": null,  "humidity": null },
        { "name": "Bath",        "temp": null,  "humidity": null }
      ]
    }
  ]
}
EOF
chmod 644 "$TMP_FILE"
mv "$TMP_FILE" "$OUT_FILE"
