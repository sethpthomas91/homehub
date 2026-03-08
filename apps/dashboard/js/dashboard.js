// dashboard.js — panels, alerts, tabs, clock, insights, solar, system
// Orchestrates all other modules. All data flows through api.js.

import { rooms, getSensorReadings, getThermalDelta, dewPoint, updateRoom } from './api.js';
import { focusRoom, applyFloorFilter, flyToFloor, setThermalMode, setTerrainVisible } from './scene3d.js';
import {
  initHistory, renderHistoryPage, renderRoomFilterBtns,
  setActiveDays,
} from './history.js';

// ============================================================
// FLOOR FILTER STATE
// ============================================================
let activeFloor = 'ALL';

// Interval IDs — retained for cleanup
let _clockIntervalId, _energyPanelIntervalId, _simulationIntervalId;

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('en-US', { hour12: false });
}
_clockIntervalId = setInterval(updateClock, 1000);
updateClock();

// ============================================================
// SENSOR CARDS
// ============================================================
function tempClass(t) {
  if (t >= 80) return 'hot';
  if (t <= 65) return 'cold';
  return 'temp';
}

function buildCards() {
  const container = document.getElementById('sensorCards');
  const activeId  = document.querySelector('.sensor-card.active')?.id;
  container.innerHTML = '';
  const floorColors = { TOP: '#dd8844', GROUND: '#33bb88', BASEMENT: '#00aacc' };
  const floorOrder  = ['TOP', 'GROUND', 'BASEMENT'];
  const floorLabels = { TOP: 'Top Floor', GROUND: 'Ground Floor', BASEMENT: 'Basement' };

  const visibleRooms = rooms.map((r, i) => ({ r, i }))
    .filter(({ r }) => activeFloor === 'ALL' || r.floor === activeFloor);

  const grouped = {};
  visibleRooms.forEach(({ r, i }) => {
    if (!grouped[r.floor]) grouped[r.floor] = [];
    grouped[r.floor].push({ r, i });
  });

  const floorsToShow = activeFloor === 'ALL'
    ? floorOrder.filter(f => grouped[f])
    : [activeFloor];

  floorsToShow.forEach(floor => {
    const divider = document.createElement('div');
    divider.className = 'floor-divider';
    divider.innerHTML = `
      <span class="floor-divider-label" style="color:${floorColors[floor]}">${floorLabels[floor]}</span>
      <div class="floor-divider-line" style="background:${floorColors[floor]}33"></div>
    `;
    container.appendChild(divider);

    (grouped[floor] || []).forEach(({ r, i }) => {
      const div = document.createElement('div');
      const isActive  = activeId ? activeId === 'card-' + i : false;
      const cardState = r.temp >= 78 ? 'state-hot' : r.temp >= 74 ? 'state-warm' : r.temp < 60 ? 'state-cold' : r.temp < 65 ? 'state-cool' : '';
      div.className = 'sensor-card' + (isActive ? ' active' : '') + (cardState ? ' ' + cardState : '');
      div.id = 'card-' + i;
      const fill = Math.max(0, Math.min(100, ((r.temp - 60) / 30 * 100))).toFixed(0);
      div.innerHTML = `
        <div class="room-name">${r.name}</div>
        <div class="readings">
          <div class="reading">
            <div class="reading-label">TEMP</div>
            <div class="reading-value ${tempClass(r.temp)}">${r.temp}°F</div>
          </div>
          <div class="reading">
            <div class="reading-label">HUMID</div>
            <div class="reading-value humid">${r.humid}%</div>
          </div>
        </div>
        <div class="status-bar"><div class="status-fill" style="width:${fill}%"></div></div>
      `;
      div.addEventListener('click', () => {
        document.querySelectorAll('.sensor-card').forEach(c => c.classList.remove('active'));
        div.classList.add('active');
        focusRoom(i);
      });
      container.appendChild(div);
    });
  });
}
buildCards();

// ============================================================
// ENERGY / ALERT PANEL
// ============================================================
function alertItem(msg, cls) {
  return `<div class="alert-item ${cls}">${msg}</div>`;
}
function alertNone(msg) {
  return `<div class="alert-none">${msg}</div>`;
}
function deltaClass(delta) {
  const abs = Math.abs(delta);
  if (abs < 8)  return 'good';
  if (abs < 15) return 'warn';
  return 'bad';
}

function updateEnergyPanel() {
  const allRooms = getSensorReadings();
  const el = id => document.getElementById(id);

  // Bottom bar
  const temps  = allRooms.map(r => r.temp);
  const humids = allRooms.map(r => r.humid);
  const avgTemp  = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
  const avgHumid = Math.round(humids.reduce((a, b) => a + b, 0) / humids.length);
  if (el('em-avg-temp'))  el('em-avg-temp').textContent  = avgTemp + '°F';
  if (el('em-avg-humid')) el('em-avg-humid').textContent = avgHumid + '%';

  const shed = allRooms.find(r => r.name === 'SHED');
  if (shed && el('em-shed-humid')) {
    el('em-shed-humid').textContent = shed.humid + '%';
    el('em-shed-humid').className = 'em-val ' + (shed.humid > 70 ? 'warn' : shed.humid > 55 ? '' : 'good');
  }

  const ref = getThermalDelta(70);
  if (el('outdoor-ref')) el('outdoor-ref').textContent = ref.outdoor.toFixed(1) + '°F';

  const deltaData = allRooms.map(r => ({ name: r.name, temp: r.temp, floor: r.floor, humid: r.humid, ...getThermalDelta(r.temp) }));
  const maxDelta  = Math.max(...deltaData.map(d => Math.abs(d.delta)));
  if (el('em-max-delta')) {
    el('em-max-delta').textContent = maxDelta.toFixed(1) + '°F';
    el('em-max-delta').className = 'em-val ' + deltaClass(maxDelta);
  }

  // Floor spread
  const topRooms  = allRooms.filter(r => r.floor === 'TOP');
  const bsmtRooms = allRooms.filter(r => r.floor === 'BASEMENT');
  const topAvg    = topRooms.reduce((a, r) => a + r.temp, 0) / topRooms.length;
  const bsmtAvg   = bsmtRooms.reduce((a, r) => a + r.temp, 0) / bsmtRooms.length;
  const spread    = topAvg - bsmtAvg;
  const spreadCls = spread > 10 ? 'spread-bad' : spread > 7 ? 'spread-warn' : 'spread-good';
  if (el('floorSpreadVal')) {
    el('floorSpreadVal').textContent = spread.toFixed(1) + '°F';
    el('floorSpreadVal').className = 'floor-spread-val ' + spreadCls;
  }
  if (el('floorSpreadDetail')) {
    const msg = spread > 10 ? 'Stack effect likely — check air sealing' : spread > 7 ? 'Monitor — approaching stack effect range' : 'Good envelope performance';
    el('floorSpreadDetail').textContent = msg;
  }

  // Health alerts
  const comfort    = [];
  const structural = [];
  const airquality = [];

  const TEMP_HOT   = 82;
  const TEMP_COLD  = 60;
  const DP_NOTE    = 54;
  const HUMID_HIGH = 68;
  const SHED_WATCH = 65;
  const SPREAD_NOTE = 10;

  allRooms.forEach(r => {
    const dp = dewPoint(r.temp, r.humid);
    if (r.temp > TEMP_HOT)  comfort.push(alertItem(`${r.name} is warm — ${r.temp.toFixed(1)}°F`, 'warn-mid'));
    if (r.temp < TEMP_COLD) comfort.push(alertItem(`${r.name} is cool — ${r.temp.toFixed(1)}°F`, 'warn-mid'));
    if (dp > DP_NOTE) structural.push(alertItem(`${r.name} dew point ${dp.toFixed(1)}°F — logged for review`, 'info'));
    if (r.name === 'SHED' && r.humid > SHED_WATCH)
      structural.push(alertItem(`Shed humidity ${r.humid}% — worth monitoring`, 'warn-mid'));
    if (r.humid > HUMID_HIGH && r.name !== 'SHED')
      airquality.push(alertItem(`${r.name} humidity ${r.humid}%`, 'info'));
  });

  if (spread > SPREAD_NOTE)
    structural.push(alertItem(`Floor spread ${spread.toFixed(1)}°F — good data point for building review`, 'info'));

  const tenantRoom = allRooms.find(r => r.name === 'TENANT ROOM' || r.name === 'TENANT LIVING RM');
  if (tenantRoom && tenantRoom.temp < 63)
    comfort.push(alertItem(`Tenant space at ${tenantRoom.temp.toFixed(1)}°F`, 'warn-mid'));

  const renderCat = (elId, items, noneMsg) => {
    const container = el(elId);
    if (!container) return;
    container.innerHTML = items.length ? items.join('') : alertNone(noneMsg);
    const catBlock = container.closest('.health-cat');
    if (catBlock) catBlock.classList.toggle('has-issues', items.length > 0);
  };
  renderCat('comfortAlerts',    comfort,    'All rooms comfortable');
  renderCat('structuralAlerts', structural, 'No structural concerns');
  renderCat('airqualityAlerts', airquality, 'Air quality nominal');

  // Header alert count
  const actionableCount = comfort.filter(a => a.includes('warn-hot') || a.includes('warn-cold')).length
    + structural.filter(a => a.includes('warn-hot')).length;
  const headerItem  = el('headerAlertItem');
  const headerCount = el('headerAlertCount');
  if (headerItem && headerCount) {
    if (actionableCount > 0) {
      headerItem.style.display = '';
      headerCount.textContent = actionableCount + '';
    } else {
      headerItem.style.display = 'none';
    }
  }

  // House status summary
  const statusEl = el('houseStatus');
  if (statusEl) {
    const totalIssues = comfort.length + structural.filter(a => a.includes('warn-mid')).length;
    const watchItems  = structural.filter(a => a.includes('info')).length;
    let cls, icon, title, sub;
    if (totalIssues > 0) {
      cls  = 'warning';
      icon = '◈';
      const plainSummaries = [];
      comfort.forEach(a => {
        const m = a.match(/class="alert-item[^"]*">([^<]+)</);
        if (m) plainSummaries.push(m[1].trim());
      });
      structural.filter(a => a.includes('warn-mid')).forEach(a => {
        const m = a.match(/class="alert-item[^"]*">([^<]+)</);
        if (m) plainSummaries.push(m[1].trim());
      });
      title = totalIssues === 1 ? 'One thing to keep an eye on' : `${totalIssues} things to keep an eye on`;
      sub   = plainSummaries.slice(0, 2).join(' · ') || 'See Insights tab for details';
    } else if (watchItems > 0) {
      cls   = 'warning';
      icon  = '◈';
      title = watchItems === 1 ? 'One thing logged' : `${watchItems} things logged`;
      sub   = 'Nothing urgent — see Insights for details';
    } else {
      cls   = 'good';
      icon  = '✓';
      title = 'Everything looks good';
      sub   = 'Collecting data — nothing unusual to report';
    }
    const isActionable = cls !== 'good';
    statusEl.innerHTML = `
      <div class="hero-status ${cls}" id="heroStatusBlock">
        <div class="hero-status-icon">${icon}</div>
        <div class="hero-status-title">${title}</div>
        <div class="hero-status-sub">${sub}${isActionable ? '<br><span style="font-family:Share Tech Mono,monospace;font-size:11px;color:#5a7a90;letter-spacing:0.5px">TAP TO VIEW INSIGHTS →</span>' : ''}</div>
      </div>`;
    const block = document.getElementById('heroStatusBlock');
    if (block && isActionable) {
      block.style.cursor = 'pointer';
      block.onclick = () => switchTab('insights');
    }
  }
}

_energyPanelIntervalId = setInterval(updateEnergyPanel, 30000);

// ============================================================
// FLOOR FILTER BUTTONS
// ============================================================
document.querySelectorAll('.floor-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFloor = btn.dataset.floor;
    document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFloorFilter(activeFloor);
    flyToFloor(activeFloor);
    buildCards();
  });
});
document.querySelector('.floor-btn[data-floor="ALL"]').classList.add('active');

// ============================================================
// SIMULATION (replace with real HA polling in Phase 1)
// ============================================================
_simulationIntervalId = setInterval(() => {
  rooms.forEach(r => {
    updateRoom(r.name, {
      temp:  Math.round((r.temp  + (Math.random() - 0.5) * 0.4) * 10) / 10,
      humid: Math.round(Math.max(30, Math.min(85, r.humid + (Math.random() - 0.5) * 0.6)) * 10) / 10,
    });
  });
  buildCards();
  const avgTemp  = (rooms.reduce((a, r) => a + r.temp,  0) / rooms.length).toFixed(1);
  const avgHumid = (rooms.reduce((a, r) => a + r.humid, 0) / rooms.length).toFixed(0);
  const _atv = document.getElementById('avg-temp-val');  if (_atv) _atv.textContent = avgTemp + '°F';
  const _ahv = document.getElementById('avg-humid-val'); if (_ahv) _ahv.textContent = avgHumid + '%';
  const _atb = document.getElementById('avg-temp-bar');  if (_atb) _atb.style.width = ((avgTemp - 60) / 30 * 100) + '%';
  const _ahb = document.getElementById('avg-humid-bar'); if (_ahb) _ahb.style.width = avgHumid + '%';
  document.getElementById('cpu-val').textContent = (28 + Math.random() * 20).toFixed(0) + '%';
  document.getElementById('pi-temp').textContent = (48 + Math.random() * 8).toFixed(0)  + '°C';
  updateEnergyPanel();
}, 3000);

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const histPage = document.getElementById('historyPage');
  const sysPage  = document.getElementById('systemPage');
  const layout   = document.querySelector('.layout');
  histPage.classList.remove('active');
  sysPage.classList.remove('active');
  document.getElementById('solarPage').classList.remove('active');
  document.getElementById('insightsPage').classList.remove('active');
  layout.classList.remove('history-mode', 'system-mode', 'solar-mode', 'insights-mode');
  if (tab === 'history') {
    histPage.classList.add('active');
    layout.classList.add('history-mode');
    renderRoomFilterBtns(renderHistoryPage);
    renderHistoryPage();
  } else if (tab === 'system') {
    sysPage.classList.add('active');
    layout.classList.add('system-mode');
    buildSensorNetworkTable();
  } else if (tab === 'solar') {
    document.getElementById('solarPage').classList.add('active');
    layout.classList.add('solar-mode');
    initSolarTab();
  } else if (tab === 'insights') {
    document.getElementById('insightsPage').classList.add('active');
    layout.classList.add('insights-mode');
    buildInsightsPage();
  }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') switchTab('dashboard');
});

// Range buttons
document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveDays(parseInt(btn.dataset.days));
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderHistoryPage();
  });
});

// ============================================================
// THERMAL TOGGLE
// ============================================================
document.getElementById('thermalToggleBtn').addEventListener('click', () => {
  const btn     = document.getElementById('thermalToggleBtn');
  const enabled = !btn.classList.contains('active');
  setThermalMode(enabled);
  btn.classList.toggle('active', enabled);
  btn.querySelector('.toggle-state').textContent = enabled ? 'ON' : 'OFF';
});

// ============================================================
// TERRAIN TOGGLE
// ============================================================
let terrainVisible = false;
document.getElementById('terrainToggleBtn').addEventListener('click', () => {
  terrainVisible = !terrainVisible;
  setTerrainVisible(terrainVisible);
  const btn = document.getElementById('terrainToggleBtn');
  btn.classList.toggle('active', terrainVisible);
  btn.querySelector('.toggle-state').textContent = terrainVisible ? 'ON' : 'OFF';
});

// ============================================================
// CTRL HINT FADE
// ============================================================
(function() {
  const hint = document.getElementById('ctrlHint');
  if (!hint) return;
  setTimeout(() => { hint.style.opacity = '0'; }, 4000);
})();

// ============================================================
// INSIGHTS TAB
// ============================================================
function buildInsightsPage() {
  const now     = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const cats = {
    comfort:    { rows: [], label: 'COMFORT',     context: 'How comfortable the rooms are right now.' },
    structural: { rows: [], label: 'STRUCTURAL',  context: 'Conditions worth logging for a future building review.' },
    airquality: { rows: [], label: 'AIR QUALITY', context: 'Humidity and air conditions across the house.' },
  };

  const TEMP_HOT   = 82, TEMP_COLD = 60, DP_NOTE    = 54;
  const HUMID_HIGH = 68, SHED_WATCH = 65, SPREAD_NOTE = 10;

  const topRooms  = rooms.filter(r => r.floor === 'TOP');
  const bsmtRooms = rooms.filter(r => r.floor === 'BASEMENT');
  const topAvg    = topRooms.reduce((a, r) => a + r.temp, 0)  / topRooms.length;
  const bsmtAvg   = bsmtRooms.reduce((a, r) => a + r.temp, 0) / bsmtRooms.length;
  const spread    = topAvg - bsmtAvg;

  rooms.forEach(r => {
    const dp = dewPoint(r.temp, r.humid);

    if (r.temp > TEMP_HOT)
      cats.comfort.rows.push({ room: r.name, msg: 'Running warm', context: 'Above typical comfort range.', val: r.temp.toFixed(1)+'°F', cls: 'watch' });
    else if (r.temp < TEMP_COLD)
      cats.comfort.rows.push({ room: r.name, msg: 'Running cool', context: 'Below typical comfort range.', val: r.temp.toFixed(1)+'°F', cls: 'watch' });
    else
      cats.comfort.rows.push({ room: r.name, msg: 'Comfortable', context: '', val: r.temp.toFixed(1)+'°F', cls: 'nominal' });

    if (dp > DP_NOTE)
      cats.structural.rows.push({ room: r.name, msg: 'Dew point elevated', context: 'Worth noting for building review. Not an emergency.', val: dp.toFixed(1)+'°F dp', cls: 'watch' });

    if (r.name === 'SHED' && r.humid > SHED_WATCH)
      cats.structural.rows.push({ room: 'SHED', msg: 'Humidity above watch level', context: 'Good data point. Ventilate on dry days when convenient.', val: r.humid+'% RH', cls: 'watch' });

    if (r.humid > HUMID_HIGH && r.name !== 'SHED')
      cats.airquality.rows.push({ room: r.name, msg: 'Humidity on the higher side', context: 'Normal range is 30–60%. Worth logging.', val: r.humid+'% RH', cls: 'watch' });
    else if (r.humid < 30)
      cats.airquality.rows.push({ room: r.name, msg: 'Air is quite dry', context: 'Below 30% can affect comfort and wood.', val: r.humid+'% RH', cls: 'watch' });
    else
      cats.airquality.rows.push({ room: r.name, msg: 'Humidity normal', context: '', val: r.humid+'% RH', cls: 'nominal' });
  });

  if (spread > SPREAD_NOTE)
    cats.structural.rows.push({ room: 'HOUSE', msg: `Floor spread ${spread.toFixed(1)}°F`, context: 'Top floor warmer than basement. Useful data for envelope review.', val: spread.toFixed(1)+'°F', cls: 'note' });

  ['comfort', 'structural', 'airquality'].forEach(cat => {
    const el = document.getElementById('insightsCat' + cat.charAt(0).toUpperCase() + cat.slice(1));
    if (!el) return;
    const { rows, label } = cats[cat];
    const noteCount = rows.filter(r => r.cls !== 'nominal').length;
    el.innerHTML = `
      <div class="insights-cat-header">
        <div class="insights-cat-dot"></div>
        <span class="insights-cat-title">${label}</span>
        <span class="insights-cat-count">${noteCount > 0 ? noteCount + ' to note' : 'all clear'} · ${timeStr}</span>
      </div>
      <div class="insights-cat-body">
        ${rows.length === 0
          ? '<div class="insights-empty">Nothing to report.</div>'
          : rows.map(row => `
            <div class="insight-row">
              <div class="insight-row-room">${row.room}</div>
              <div>
                <div class="insight-row-msg">${row.msg}</div>
                ${row.context ? `<div class="insight-row-context">${row.context}</div>` : ''}
              </div>
              <div class="insight-row-val ${row.cls}">${row.val}</div>
            </div>`).join('')
        }
      </div>`;
  });
}

// ============================================================
// SOLAR TAB
// ============================================================
function initSolarTab() {
  renderSolarLuxChart();
}

function renderSolarLuxChart() {
  const canvas = document.getElementById('solarLuxChart');
  if (!canvas) return;
  const dpr  = window.devicePixelRatio || 1;
  const CSSw = canvas.parentElement.offsetWidth || 400;
  const CSSh = 140;
  canvas.width  = Math.round(CSSw * dpr);
  canvas.height = Math.round(CSSh * dpr);
  canvas.style.width  = CSSw + 'px';
  canvas.style.height = CSSh + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = CSSw, H = CSSh;
  const PAD = { top: 10, right: 16, bottom: 28, left: 44 };
  const CW  = W - PAD.left - PAD.right;
  const CH  = H - PAD.top  - PAD.bottom;

  ctx.clearRect(0, 0, W, H);

  const hours     = Array.from({ length: 13 }, (_, i) => i + 6);
  const eastCurve = hours.map(h => {
    const t = (h - 6) / 12;
    return Math.max(0, Math.sin(Math.PI * t * 1.5) * (h <= 13 ? 1 : 0.1)) * 80000;
  });
  const westCurve = hours.map(h => {
    const t = (h - 6) / 12;
    return Math.max(0, Math.sin(Math.PI * (t - 0.4) * 1.5) * (h >= 11 ? 1 : 0.1)) * 80000;
  });

  const maxV = 90000;
  const xOf  = i => PAD.left + (i / (hours.length - 1)) * CW;
  const yOf  = v => PAD.top  + (1 - v / maxV) * CH;

  [0, 0.25, 0.5, 0.75, 1].forEach(t => {
    const y = PAD.top + (1 - t) * CH;
    ctx.strokeStyle = 'rgba(180,210,240,0.07)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + CW, y); ctx.stroke();
    ctx.fillStyle = '#5a7a90';
    ctx.font = '11px "Share Tech Mono",monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(t * 90) + 'k', PAD.left - 6, y + 4);
  });

  const drawCurve = (data, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = xOf(i), y = yOf(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawCurve(eastCurve, '#ffaa44');
  drawCurve(westCurve, '#aa88ff');

  ctx.fillStyle = '#5a7a90';
  ctx.font = '11px "Share Tech Mono",monospace';
  ctx.textAlign = 'center';
  [0, 3, 6, 9, 12].forEach(i => {
    ctx.fillText(hours[i] + 'h', xOf(i), H - 8);
  });

  ctx.fillStyle = '#ffaa44'; ctx.font = '11px "Share Tech Mono",monospace'; ctx.textAlign = 'left';
  ctx.fillText('— EAST (model)', PAD.left, PAD.top + 12);
  ctx.fillStyle = '#aa88ff';
  ctx.fillText('— WEST (model)', PAD.left + 120, PAD.top + 12);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = '11px "Share Tech Mono",monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SENSOR NOT INSTALLED — MODEL CURVE SHOWN', W/2, H/2 + 4);
}

// ============================================================
// SYSTEM TAB — SENSOR NETWORK TABLE
// ============================================================
const sensorLastUpdated = {};

function buildSensorNetworkTable() {
  const container = document.getElementById('sensorNetworkTable');
  if (!container) return;

  const now = new Date();
  rooms.forEach(r => {
    if (!sensorLastUpdated[r.name]) sensorLastUpdated[r.name] = now;
  });

  const floorColor = { TOP: '#dd8844', GROUND: '#33bb88', BASEMENT: '#00aacc' };

  const byFloor = [
    { label: 'TOP FLOOR',    rooms: rooms.filter(r => r.floor === 'TOP') },
    { label: 'GROUND FLOOR', rooms: rooms.filter(r => r.floor === 'GROUND' && r.name !== 'SHED') },
    { label: 'BASEMENT',     rooms: rooms.filter(r => r.floor === 'BASEMENT') },
    { label: 'DETACHED',     rooms: rooms.filter(r => r.name === 'SHED') },
  ];

  const plannedSensors = [
    { name: 'OUTDOOR TEMP/HUMID',       type: 'ESP32 + DHT22',   status: 'INSTALL' },
    { name: 'CO2 — MASTER BED',         type: 'MH-Z19B',         status: 'PENDING' },
    { name: 'CO2 — GREAT ROOM',         type: 'MH-Z19B',         status: 'PENDING' },
    { name: 'CO2 — OFFICE',             type: 'MH-Z19B',         status: 'PENDING' },
    { name: 'ENERGY MONITOR',           type: 'Emporia Vue',      status: 'PENDING' },
    { name: 'ZIGBEE COORDINATOR',       type: 'Sonoff Dongle',    status: 'PENDING' },
    { name: 'WATER LEAK — WATER HEATER', type: 'Resistive probe', status: 'PENDING' },
  ];

  let html = '<table class="sn-table">';
  html += '<thead><tr><th>SENSOR</th><th>TYPE</th><th style="text-align:right">READING</th><th style="text-align:right">UPDATED</th></tr></thead><tbody>';

  byFloor.forEach(({ label, rooms: floorRooms }) => {
    if (!floorRooms.length) return;
    html += `<tr class="sn-section-row"><td colspan="4">// ${label}</td></tr>`;
    floorRooms.forEach(r => {
      const updated = sensorLastUpdated[r.name];
      const secAgo  = updated ? Math.floor((now - updated) / 1000) : 0;
      const updStr  = secAgo < 5 ? 'JUST NOW' : secAgo < 60 ? `${secAgo}s AGO` : `${Math.floor(secAgo/60)}m AGO`;
      html += `<tr>
        <td><span class="sn-name">${r.name}</span></td>
        <td style="color:var(--dim);font-size:13px">ESP32 + DHT22</td>
        <td class="sn-val">${r.temp.toFixed(1)}°F &nbsp; ${r.humid.toFixed(0)}%</td>
        <td class="sn-updated"><span class="sn-status-live">● LIVE</span> &nbsp; ${updStr}</td>
      </tr>`;
    });
  });

  html += `<tr class="sn-section-row"><td colspan="4">// PLANNED</td></tr>`;
  plannedSensors.forEach(s => {
    html += `<tr>
      <td><span class="sn-name">${s.name}</span></td>
      <td style="color:var(--dim);font-size:13px">${s.type}</td>
      <td class="sn-val" style="color:var(--dim)">--</td>
      <td class="sn-updated"><span class="sn-status-pending">○ ${s.status}</span></td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ============================================================
// INIT
// ============================================================
updateEnergyPanel();
initHistory();

export function destroyDashboard() {
  if (_clockIntervalId)       { clearInterval(_clockIntervalId);       _clockIntervalId       = null; }
  if (_energyPanelIntervalId) { clearInterval(_energyPanelIntervalId); _energyPanelIntervalId = null; }
  if (_simulationIntervalId)  { clearInterval(_simulationIntervalId);  _simulationIntervalId  = null; }
}
