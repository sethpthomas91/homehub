#!/bin/bash
# system_stats.sh — read Pi system metrics and write JSON atomically
# Run by systemd timer every 30s
# Output: /var/www/homehub/api/system.json

OUT_DIR="/var/www/homehub/api"
OUT_FILE="$OUT_DIR/system.json"
TMP_FILE="/var/www/homehub/api/.system_stats_tmp.json"

# CPU% — two-sample /proc/stat delta (0.5s apart)
read_cpu_sample() {
  awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8, $5}' /proc/stat
}
read sample1_total sample1_idle <<< "$(read_cpu_sample)"
sleep 0.5
read sample2_total sample2_idle <<< "$(read_cpu_sample)"
total_diff=$((sample2_total - sample1_total))
idle_diff=$((sample2_idle - sample1_idle))
if [ "$total_diff" -gt 0 ]; then
  cpu_pct=$(( (total_diff - idle_diff) * 100 / total_diff ))
else
  cpu_pct=0
fi

# CPU temp — guard if file absent
TEMP_FILE="/sys/class/thermal/thermal_zone0/temp"
if [ -f "$TEMP_FILE" ]; then
  raw_temp=$(cat "$TEMP_FILE")
  cpu_temp_c=$((raw_temp / 1000))
else
  cpu_temp_c=0
fi

# RAM — from /proc/meminfo
mem_total_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
mem_avail_kb=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
mem_used_kb=$((mem_total_kb - mem_avail_kb))
# Convert to GB with 1 decimal — awk handles leading zero correctly
ram_used_gb=$(awk "BEGIN {printf \"%.1f\", $mem_used_kb / 1048576}")
ram_total_gb=$(awk "BEGIN {printf \"%.1f\", $mem_total_kb / 1048576}")

# Uptime — first field of /proc/uptime as integer seconds
uptime_seconds=$(awk '{print int($1)}' /proc/uptime)

# Timestamp
generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Write JSON atomically
mkdir -p "$OUT_DIR"
cat > "$TMP_FILE" <<EOF
{
  "cpu_pct": $cpu_pct,
  "cpu_temp_c": $cpu_temp_c,
  "ram_used_gb": $ram_used_gb,
  "ram_total_gb": $ram_total_gb,
  "uptime_seconds": $uptime_seconds,
  "generated_at": "$generated_at"
}
EOF
mv "$TMP_FILE" "$OUT_FILE"
