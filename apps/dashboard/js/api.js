// api.js — data contract + source adapter
//
// Shape every sensor reading matches:
// {
//   name: string,          e.g. "MASTER BEDROOM"
//   floor: string,         "TOP" | "GROUND" | "BASEMENT"
//   temp: number,          °F
//   humid: number,         % RH
//   pos: [x, y, z],        3D scene position
//   size: [w, h, d],       3D scene dimensions
// }
//
// To swap sources: replace the body of getSensorReadings() only.
// Phase 1: call HA REST API. Phase 2: read InfluxDB. Nothing else changes.

// ============================================================
// COORDINATE SYSTEM
// ============================================================
/*
  X: west(-) to east(+)
  Y: ground(0) up — each floor is 1.1 units tall
  Z: north(-) to south(+)   ← north is "up" on screen = negative Z

  HOUSE LAYOUT (from aerial photo):
    South block (main house): wider, ~4.4 wide x 3.8 deep, 2 floors + basement
    North block (separate unit): ~3.6 wide x 3.2 deep, attached to north side of south block, 2 floors

  Floor heights:
    Basement: y center = -1.1
    Ground:   y center =  0.55
    Top:      y center =  1.65
*/

export const FLOOR_H = 1.1;
export const BAS_Y   = -FLOOR_H;
export const GND_Y   =  0;
export const TOP_Y   =  FLOOR_H;

export const yB = BAS_Y + FLOOR_H / 2;  // -0.55
export const yG = GND_Y + FLOOR_H / 2;  //  0.55
export const yT = TOP_Y + FLOOR_H / 2;  //  1.65

// GAP between adjacent rooms (eliminates z-fighting)
export const G = 0.04;

// Helper: build room from min/max bounds with inset gap
export function rm(name, floor, temp, humid, xMin, xMax, zMin, zMax, floorY) {
  const w  = (xMax - xMin) - G;
  const d  = (zMax - zMin) - G;
  const cx = (xMin + xMax) / 2;
  const cz = (zMin + zMax) / 2;
  return { name, floor, temp, humid, pos: [cx, floorY, cz], size: [w, FLOOR_H - G, d] };
}

// ============================================================
// SIMULATED ADAPTER — rooms[] is the live data store
// ============================================================
export const rooms = [
  // TOP FLOOR — South block
  rm('MASTER BEDROOM',  'TOP',      69, 41,  -2.86,  0.6, -1.6,  2.2,  yT),
  rm('MASTER BATHROOM', 'TOP',      73, 62,   0.6,  2.31, -1.6,  2.2,  yT),

  // GROUND FLOOR — North block
  rm('KITCHEN',         'GROUND',   75, 55,  -1.8, -0.6, -4.8, -2.67, yG),
  rm('LIVING ROOM',     'GROUND',   72, 46,  -0.6,  1.8, -4.8, -2.67, yG),
  rm('BATHROOM',        'GROUND',   74, 68,  -1.8, -0.6, -2.67,-1.6,  yG),
  rm('OFFICE',          'GROUND',   71, 44,  -0.6,  1.8, -2.67,-1.6,  yG),

  // GROUND FLOOR — South block
  rm('GREAT KITCHEN',   'GROUND',   73, 50,  -2.86, -0.73, -1.6,  0.3,  yG),
  rm('STAIRS',          'GROUND',   68, 42,  -2.86, -0.73,  0.3,  2.2,  yG),
  rm('GREAT ROOM',      'GROUND',   71, 44,  -0.73, 2.31,  -1.6,  2.2,  yG),

  // DETACHED SHED
  rm('SHED',            'GROUND',   62, 38,  -1.2,  1.2,   6.8,  8.8,  -0.3227 + FLOOR_H/2),

  rm('TENANT ROOM',     'BASEMENT', 68, 48,  -0.6,  1.8, -4.8, -2.67, yB),
  rm('UTILITY ROOM',    'BASEMENT', 62, 50,  -1.8,  1.8, -2.67,-1.6,  yB),
  rm('TENANT BATHROOM', 'BASEMENT', 66, 52,  -1.8, -0.6, -4.8, -2.67, yB),

  // SOUTH BLOCK BASEMENT
  rm('TENANT LIVING RM', 'BASEMENT', 68, 45,  -2.86,  0.0, -1.6,  0.571, yB),
  rm('TENANT KITCHEN',   'BASEMENT', 70, 50,   0.0,  2.31, -1.6,  0.029, yB),
  rm('GUEST BATHROOM',   'BASEMENT', 68, 58,   0.0,  2.31,  0.029, 0.571, yB),
  rm('GUEST BEDROOM',    'BASEMENT', 67, 44,  -2.86,  2.31,  0.571, 2.2,  yB),
];

// The data contract: all modules call this instead of reading rooms[] directly
export function getSensorReadings() {
  return rooms;
}

// ============================================================
// UTILITY FUNCTIONS (consumed by multiple modules)
// ============================================================

// Dew point via Magnus formula — returns °F
// Thresholds: <50°F safe, 50-55°F monitor, >55°F act
export function dewPoint(tempF, rh) {
  const tc = (tempF - 32) * 5 / 9;
  const a = 17.27, b = 237.7;
  const alpha = ((a * tc) / (b + tc)) + Math.log(rh / 100);
  const dpC = (b * alpha) / (a - alpha);
  return dpC * 9 / 5 + 32;
}

// Thermal delta vs simulated outdoor
// When outdoor sensor is installed, replace body with real HA API call
export function getThermalDelta(roomTemp) {
  const hour  = new Date().getHours();
  const month = new Date().getMonth(); // 0=Jan
  const seasonBase = 25 + 25 * Math.sin((month - 2) / 12 * 2 * Math.PI);
  const diurnal    = 8  * Math.sin((hour - 14) / 24 * 2 * Math.PI);
  const simOutdoor = seasonBase + diurnal;
  return { delta: roomTemp - simOutdoor, outdoor: simOutdoor, simulated: true };
}

// ============================================================
// THRESHOLD CONSTANTS — shared across dashboard.js modules
// ============================================================
export const TEMP_HOT    = 82;
export const TEMP_COLD   = 60;
export const DP_NOTE     = 54;
export const HUMID_HIGH  = 68;
export const SHED_WATCH  = 65;
export const SPREAD_NOTE = 10;

// ============================================================
// ROOMS UPDATE — route mutations here instead of mutating rooms[] directly
// ============================================================
const _roomsUpdateCallbacks = [];

export function onRoomsUpdate(callback) {
  _roomsUpdateCallbacks.push(callback);
}

export function updateRoom(name, patch) {
  const room = rooms.find(r => r.name === name);
  if (!room) return;
  Object.assign(room, patch);
  _roomsUpdateCallbacks.forEach(cb => cb(rooms));
}

// ============================================================
// PI SYSTEM STATS — fetches /api/system.json (written by systemd timer)
// ============================================================

export async function fetchSystemStats() {
  try {
    const res = await fetch('/api/system.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch {
    return null;  // caller shows '--' on null
  }
}

export function formatUptime(seconds) {
  if (seconds == null) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

export function tempColor(t) {
  if (t >= 78) return '#ff6b35';
  if (t >= 74) return '#ffaa44';
  if (t >= 70) return '#ffd080';
  if (t >= 65) return '#c8d8e8';
  if (t >= 60) return '#88bbdd';
  return '#4499ff';
}
