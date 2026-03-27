#!/bin/bash
set -e

TOKEN_FILE="/etc/homehub/ha_token"
OUT_DIR="/var/www/homehub/api"
OUT_FILE="$OUT_DIR/sensors.json"
TMP_FILE="$OUT_DIR/.sensors_tmp.json"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "fetch_sensors: token file not found at $TOKEN_FILE" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

python3 << PYEOF
import json, urllib.request, datetime

TOKEN = open('$TOKEN_FILE').read().strip()
HA    = 'http://localhost:8123'

def get(path):
    req = urllib.request.Request(f'{HA}{path}',
          headers={'Authorization': f'Bearer {TOKEN}'})
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

def template(tmpl):
    body = json.dumps({'template': tmpl}).encode()
    req  = urllib.request.Request(f'{HA}/api/template', data=body,
           headers={'Authorization': f'Bearer {TOKEN}',
                    'Content-Type': 'application/json'})
    return urllib.request.urlopen(req, timeout=5).read().decode()

# Pull floor -> area -> entity structure directly from HA
structure = json.loads(template("""
{% set ns = namespace(floors=[]) %}
{% for fid in floors() %}
  {% set rns = namespace(rooms=[]) %}
  {% for aid in floor_areas(fid) %}
    {% set t = area_entities(aid) | select('match', 'sensor\\\\..*_temperature') | list %}
    {% set h = area_entities(aid) | select('match', 'sensor\\\\..*_humidity')    | list %}
    {% set rns.rooms = rns.rooms + [{"name": area_name(aid), "t": t[0] if t else "", "h": h[0] if h else ""}] %}
  {% endfor %}
  {% set ns.floors = ns.floors + [{"name": floor_name(fid), "rooms": rns.rooms}] %}
{% endfor %}
{{ ns.floors | tojson }}
"""))

# Fetch all states once
states = {e['entity_id']: e['state'] for e in get('/api/states')}

def val(entity_id):
    if not entity_id:
        return None
    v = states.get(entity_id, 'unavailable')
    try:
        return round(float(v))
    except (ValueError, TypeError):
        return None

floors_out = []
for floor in structure:
    rooms_out = []
    for room in floor['rooms']:
        rooms_out.append({
            'name':     room['name'],
            'temp':     val(room['t']),
            'humidity': val(room['h']),
        })
    floors_out.append({'name': floor['name'], 'rooms': rooms_out})

output = {
    'generated_at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    'floors': floors_out,
}

with open('$TMP_FILE', 'w') as f:
    json.dump(output, f, indent=2)
PYEOF

chmod 644 "$TMP_FILE"
mv "$TMP_FILE" "$OUT_FILE"
