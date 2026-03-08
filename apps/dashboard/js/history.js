// history.js — chart rendering engine + localStorage logging
// Fully self-contained. Called by dashboard.js with container IDs.

import { rooms, getSensorReadings, getThermalDelta } from './api.js';

// ============================================================
// STORAGE
// ============================================================
const HISTORY_KEY  = 'homehub-history-v1';
const LOG_INTERVAL = 5 * 60 * 1000; // 5 minutes
let   historyData  = [];             // [{ts, rooms:[{name,floor,temp,humid}]}]

export let activeDays       = 7;
export let activeRoomFilter = new Set(); // empty = all

// Room palette — consistent colors per room name
const ROOM_PALETTE  = {};
const PALETTE_COLORS = [
  '#00d4ff','#33dd88','#ffbb00','#ff6b35','#aa44ff',
  '#ff4488','#44ffdd','#ffdd44','#88aaff','#ff8844',
  '#44ff88','#dd44ff','#88ddff','#ffaa44','#44ddaa',
  '#ff44aa','#aaffaa','#ffff44','#44aaff','#dd8844',
];

function roomColor(name) {
  if (!ROOM_PALETTE[name]) {
    const idx = Object.keys(ROOM_PALETTE).length % PALETTE_COLORS.length;
    ROOM_PALETTE[name] = PALETTE_COLORS[idx];
  }
  return ROOM_PALETTE[name];
}

export async function loadHistory() {
  try {
    const r = await window.storage.get(HISTORY_KEY);
    if (r) historyData = JSON.parse(r.value);
  } catch(e) { historyData = []; }
}

export async function saveSnapshot() {
  const snapshot = {
    ts: Date.now(),
    rooms: rooms.map(r => ({ name: r.name, floor: r.floor, temp: r.temp, humid: r.humid })),
  };
  historyData.push(snapshot);
  if (historyData.length > 25920) historyData.splice(0, historyData.length - 25920);
  try { await window.storage.set(HISTORY_KEY, JSON.stringify(historyData)); } catch(e) {}
}

export function initHistory() {
  loadHistory().then(() => {
    saveSnapshot();
    setInterval(saveSnapshot, LOG_INTERVAL);
  });
}

// ============================================================
// FILTERED DATA
// ============================================================
function filteredData() {
  if (activeDays === 0) return historyData;
  const cutoff = Date.now() - activeDays * 86400000;
  return historyData.filter(s => s.ts >= cutoff);
}

// ============================================================
// CANVAS CHART RENDERER
// ============================================================
export function drawLineChart(canvasId, datasets, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dpr  = window.devicePixelRatio || 1;
  const CSSw = canvas.parentElement.offsetWidth || 600;
  const CSSh = canvas.offsetHeight || 200;
  canvas.width  = Math.round(CSSw * dpr);
  canvas.height = Math.round(CSSh * dpr);
  canvas.style.width  = CSSw + 'px';
  canvas.style.height = CSSh + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = CSSw, H = CSSh;

  ctx.clearRect(0, 0, W, H);

  const PAD = { top: 16, right: 20, bottom: 36, left: 52 };
  const CW  = W - PAD.left - PAD.right;
  const CH  = H - PAD.top  - PAD.bottom;

  if (!datasets.length || !datasets[0].points.length) {
    ctx.fillStyle = 'rgba(180,200,220,0.3)';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NO DATA YET — LOGGING STARTS NOW', W/2, H/2);
    return;
  }

  const allVals = datasets.flatMap(d => d.points.map(p => p.v));
  let minV = opts.minV ?? (Math.min(...allVals) - 2);
  let maxV = opts.maxV ?? (Math.max(...allVals) + 2);
  if (maxV === minV) { minV -= 1; maxV += 1; }

  const allTs  = datasets.flatMap(d => d.points.map(p => p.ts));
  const minT   = Math.min(...allTs);
  const maxT   = Math.max(...allTs);
  const tRange = maxT - minT || 1;

  const xOf = ts => PAD.left + ((ts - minT) / tRange) * CW;
  const yOf = v  => PAD.top  + (1 - (v - minV) / (maxV - minV)) * CH;

  // Grid lines
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y   = PAD.top + (i / gridLines) * CH;
    const val = maxV - (i / gridLines) * (maxV - minV);
    ctx.strokeStyle = i === gridLines ? 'rgba(180,210,240,0.15)' : 'rgba(180,210,240,0.07)';
    ctx.lineWidth = i === gridLines ? 1 : 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + CW, y); ctx.stroke();
    ctx.fillStyle = '#7a9ab0';
    ctx.font = '13px "Share Tech Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(0) + (opts.unit || ''), PAD.left - 8, y + 4);
  }

  ctx.strokeStyle = 'rgba(180,210,240,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + CH); ctx.stroke();

  // Threshold lines
  if (opts.thresholds) {
    opts.thresholds.forEach(t => {
      const y = yOf(t.val);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + CW, y); ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  // Range bands
  datasets.forEach(d => {
    if (!d.bands || d.bands.length < 2) return;
    ctx.fillStyle = d.color + '18';
    ctx.beginPath();
    d.bands[0].forEach((p, i) => {
      const x = xOf(p.ts), y = yOf(p.v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    [...d.bands[1]].reverse().forEach(p => ctx.lineTo(xOf(p.ts), yOf(p.v)));
    ctx.closePath(); ctx.fill();
  });

  // Lines
  datasets.forEach(d => {
    if (!d.points.length) return;
    const lw = d.width || 1.5;
    if (lw >= 2) {
      ctx.strokeStyle = d.color + '30';
      ctx.lineWidth = lw + 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      d.points.forEach((p, i) => {
        const x = xOf(p.ts), y = yOf(p.v);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.strokeStyle = d.color;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.setLineDash(d.dash || []);
    ctx.beginPath();
    d.points.forEach((p, i) => {
      const x = xOf(p.ts), y = yOf(p.v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // X-axis labels
  const maxLabels = Math.min(7, Math.floor(CW / 90));
  ctx.fillStyle = '#7a9ab0';
  ctx.font = '13px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= maxLabels; i++) {
    const ts  = minT + (i / maxLabels) * tRange;
    const x   = xOf(ts);
    const d   = new Date(ts);
    const lbl = activeDays <= 1
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : (d.getMonth()+1) + '/' + d.getDate() + ' ' + d.getHours() + 'h';
    ctx.strokeStyle = 'rgba(180,210,240,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, PAD.top + CH); ctx.lineTo(x, PAD.top + CH + 4); ctx.stroke();
    ctx.fillText(lbl, x, H - 10);
  }
}

// ============================================================
// DATASET BUILDERS
// ============================================================
export function buildDatasets(metric, roomFilter) {
  const data = filteredData();
  if (!data.length) return [];
  const roomMap = {};
  data.forEach(snap => {
    snap.rooms.forEach(r => {
      if (roomFilter.size && !roomFilter.has(r.name)) return;
      if (!roomMap[r.name]) roomMap[r.name] = { name: r.name, floor: r.floor, points: [] };
      roomMap[r.name].points.push({ ts: snap.ts, v: r[metric] });
    });
  });
  return Object.values(roomMap).map(r => ({
    name: r.name, floor: r.floor,
    color: roomColor(r.name),
    points: r.points,
  }));
}

export function buildFloorDatasets(metric = 'temp') {
  const data = filteredData();
  if (!data.length) return [];
  const floors      = ['BASEMENT', 'GROUND', 'TOP'];
  const floorColors = { BASEMENT: '#00aacc', GROUND: '#33bb88', TOP: '#dd8844' };
  return floors.map(floor => {
    const points = data.map(snap => {
      const fr = snap.rooms.filter(r => r.floor === floor);
      if (!fr.length) return null;
      return { ts: snap.ts, v: fr.reduce((a, r) => a + r[metric], 0) / fr.length };
    }).filter(Boolean);
    return { name: floor + ' AVG', color: floorColors[floor], points, width: 2.5 };
  }).filter(d => d.points.length);
}

function buildShedDataset() {
  const data   = filteredData();
  const points = data.map(snap => {
    const shed = snap.rooms.find(r => r.name === 'SHED');
    return shed ? { ts: snap.ts, v: shed.humid } : null;
  }).filter(Boolean);
  return [{ name: 'SHED', color: '#33dd88', points, width: 2 }];
}

// ============================================================
// STATS + LEGEND RENDERERS
// ============================================================
function renderStats(containerId, datasets, metric) {
  const el = document.getElementById(containerId);
  if (!el || !datasets.length) return;
  const allPts = datasets.flatMap(d => d.points.map(p => p.v));
  if (!allPts.length) { el.innerHTML = ''; return; }
  const avg  = allPts.reduce((a, b) => a + b, 0) / allPts.length;
  const min  = Math.min(...allPts);
  const max  = Math.max(...allPts);
  const unit = metric === 'temp' ? '°F' : '%';
  el.innerHTML = `
    <div class="stat-chip"><span class="stat-chip-label">AVG</span><span class="stat-chip-val">${avg.toFixed(1)}${unit}</span></div>
    <div class="stat-chip"><span class="stat-chip-label">MIN</span><span class="stat-chip-val">${min.toFixed(1)}${unit}</span></div>
    <div class="stat-chip"><span class="stat-chip-label">MAX</span><span class="stat-chip-val">${max.toFixed(1)}${unit}</span></div>
    <div class="stat-chip"><span class="stat-chip-label">SPREAD</span><span class="stat-chip-val ${(max-min)>10?'warn':''}">${(max-min).toFixed(1)}${unit}</span></div>
    <div class="stat-chip"><span class="stat-chip-label">SNAPSHOTS</span><span class="stat-chip-val">${filteredData().length}</span></div>
  `;
}

function renderLegend(containerId, datasets) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = datasets.map(d =>
    `<div class="legend-item"><div class="legend-dot" style="background:${d.color}"></div>${d.name}</div>`
  ).join('');
}

function renderDeltaChart() {
  const data = filteredData();
  if (!data.length) return;
  const roomFilter = activeRoomFilter;
  const roomMap    = {};
  data.forEach(snap => {
    snap.rooms.forEach(r => {
      if (roomFilter.size && !roomFilter.has(r.name)) return;
      if (!roomMap[r.name]) roomMap[r.name] = { name: r.name, points: [] };
      const { delta } = getThermalDelta(r.temp);
      roomMap[r.name].points.push({ ts: snap.ts, v: delta });
    });
  });
  const datasets = Object.values(roomMap).map(r => ({
    name: r.name, color: roomColor(r.name), points: r.points,
  }));

  const avgDeltas = datasets.map(d => ({
    name: d.name,
    avg: d.points.reduce((a, p) => a + Math.abs(p.v), 0) / d.points.length,
  })).sort((a, b) => b.avg - a.avg);
  const el = document.getElementById('deltaStats');
  if (el && avgDeltas.length) {
    el.innerHTML = avgDeltas.slice(0, 3).map((d, i) =>
      `<div class="stat-chip">
        <span class="stat-chip-label">#${i+1} WORST</span>
        <span class="stat-chip-val warn">${d.name.slice(0,10)}</span>
      </div>`
    ).join('');
  }
  drawLineChart('deltaChart', datasets, { unit: '°F', minV: -20, maxV: 20 });
  renderLegend('deltaLegend', datasets.slice(0, 8));
}

function renderShedChart() {
  const ds = buildShedDataset();
  const el = document.getElementById('shedStats');
  if (el && ds[0] && ds[0].points.length) {
    const vals = ds[0].points.map(p => p.v);
    const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
    const max  = Math.max(...vals);
    const risk = vals.filter(v => v > 55).length;
    el.innerHTML = `
      <div class="stat-chip"><span class="stat-chip-label">AVG HUMID</span><span class="stat-chip-val">${avg.toFixed(1)}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">MAX HUMID</span><span class="stat-chip-val ${max>55?'warn':''}">${max.toFixed(1)}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">RISK READINGS</span><span class="stat-chip-val ${risk>0?'warn':'good'}">${risk}</span></div>
    `;
  }
  drawLineChart('shedChart', ds, {
    unit: '%', minV: 20, maxV: 80,
    thresholds: [{ val: 55, color: '#ff4444' }, { val: 45, color: '#ffbb00' }],
  });
}

// ============================================================
// ROOM FILTER BUTTONS
// ============================================================
export function renderRoomFilterBtns(onFilterChange) {
  const el = document.getElementById('roomFilterBtns');
  if (!el) return;
  const uniqueRooms = [...new Set(rooms.map(r => r.name))];
  el.innerHTML = uniqueRooms.map(name =>
    `<button class="room-filter-btn ${activeRoomFilter.has(name) ? 'active' : ''}" data-room="${name}">${name}</button>`
  ).join('');
  el.querySelectorAll('.room-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.room;
      if (activeRoomFilter.has(name)) activeRoomFilter.delete(name);
      else activeRoomFilter.add(name);
      btn.classList.toggle('active');
      onFilterChange();
    });
  });
}

// ============================================================
// MAIN HISTORY PAGE RENDER
// ============================================================
export function renderHistoryPage() {
  const useFloorDefault = activeRoomFilter.size === 0;
  const tempDs  = useFloorDefault ? buildFloorDatasets('temp')  : buildDatasets('temp',  activeRoomFilter);
  const humidDs = useFloorDefault ? buildFloorDatasets('humid') : buildDatasets('humid', activeRoomFilter);
  const floorDs = buildFloorDatasets('temp');

  const cnt     = filteredData().length;
  const countEl = document.getElementById('dataPointCount');
  if (countEl) countEl.textContent = cnt + ' SNAPSHOTS';

  const viewLabel = useFloorDefault ? '— BY FLOOR AVG' : '— SELECTED ROOMS';
  const tlEl = document.getElementById('tempChartLabel');
  const hlEl = document.getElementById('humidChartLabel');
  if (tlEl) tlEl.textContent = viewLabel;
  if (hlEl) hlEl.textContent = viewLabel;

  renderStats('tempStats',  tempDs,  'temp');
  renderStats('humidStats', humidDs, 'humid');
  drawLineChart('tempChart',  tempDs,  { unit: '°F' });
  drawLineChart('humidChart', humidDs, { unit: '%', minV: 0, maxV: 100 });
  renderLegend('tempLegend',  tempDs);
  renderLegend('humidLegend', humidDs);
  renderDeltaChart();
  renderShedChart();

  const flEl = document.getElementById('floorStats');
  if (flEl && floorDs.length) {
    flEl.innerHTML = floorDs.map(d => {
      const avg = d.points.reduce((a, p) => a + p.v, 0) / d.points.length;
      return `<div class="stat-chip"><span class="stat-chip-label">${d.name}</span><span class="stat-chip-val">${avg.toFixed(1)}°F avg</span></div>`;
    }).join('');
  }
  drawLineChart('floorChart', floorDs, { unit: '°F', width: 2 });
  renderLegend('floorLegend', floorDs);
}

export function setActiveDays(days) {
  activeDays = days;
}
