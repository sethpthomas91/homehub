#!/bin/bash
set -e
URL="https://api.open-meteo.com/v1/forecast\
?latitude=47.67&longitude=-122.36\
&current=temperature_2m,weathercode\
&daily=temperature_2m_max,temperature_2m_min\
&temperature_unit=fahrenheit\
&timezone=America%2FLos_Angeles"
DEST=/var/www/homehub/api/weather.json
TMP=$(mktemp)
curl -sf --max-time 10 "$URL" -o "$TMP"
mv "$TMP" "$DEST"
