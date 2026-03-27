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

parse() {
  python3 -c "import sys,json; v=json.load(sys.stdin).get('state'); print(round(float(v)) if v not in (None,'unavailable','unknown') else 'null')"
}

office_temp=$(fetch_state  "sensor.office_sensor_office_temperature"                       | parse)
office_humid=$(fetch_state "sensor.office_sensor_office_humidity"                          | parse)
living_temp=$(fetch_state  "sensor.cabin_living_sensor_cabin_living_temperature"           | parse)
living_humid=$(fetch_state "sensor.cabin_living_sensor_cabin_living_humidity"              | parse)
bedroom_temp=$(fetch_state "sensor.main_bedroom_sensor_main_bedroom_temperature"           | parse)
bedroom_humid=$(fetch_state "sensor.main_bedroom_sensor_main_bedroom_humidity"             | parse)

generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p "$OUT_DIR"

cat > "$TMP_FILE" <<EOF
{
  "generated_at": "$generated_at",
  "floors": [
    {
      "name": "Cabin",
      "rooms": [
        { "name": "Office",      "temp": $office_temp,   "humidity": $office_humid },
        { "name": "Living room", "temp": $living_temp,   "humidity": $living_humid },
        { "name": "Bedroom",     "temp": $bedroom_temp,  "humidity": $bedroom_humid },
        { "name": "Bath",        "temp": null,           "humidity": null }
      ]
    }
  ]
}
EOF
chmod 644 "$TMP_FILE"
mv "$TMP_FILE" "$OUT_FILE"
