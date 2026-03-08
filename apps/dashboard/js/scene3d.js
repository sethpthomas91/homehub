// scene3d.js — Three.js scene, geometry, animation loop
// Imports room data from api.js. Self-contained — replace with 2D floor plan later
// without touching anything else.

import {
  rooms, getSensorReadings,
  FLOOR_H, BAS_Y, GND_Y, TOP_Y, yB, yG, yT,
} from './api.js';

// ============================================================
// SCENE STATE
// ============================================================
let selectedRoom = -1;
let hoveredRoom  = -1;
export let thermalDeltaMode = true;

// ============================================================
// RENDERER / SCENE / CAMERA
// ============================================================
const canvas = document.getElementById('threeCanvas');
const wrap   = document.getElementById('canvasWrap');
if (!canvas || !wrap) {
  console.error('scene3d.js: #threeCanvas or #canvasWrap not found — aborting');
  throw new Error('scene3d: missing DOM elements');
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1520);
scene.fog = new THREE.Fog(0x0d1520, 18, 35);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

// Lighting
const ambient = new THREE.AmbientLight(0x6688aa, 2.0);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xddeeff, 2.2);
sun.position.set(6, 10, 6);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xaaccdd, 0.5);
fill.position.set(-4, 4, -4);
scene.add(fill);

// ============================================================
// TERRAIN
// ============================================================
const SEGS = 48;
const TERRAIN_W = 30;
const TERRAIN_D = 32;
const terrainGeo = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, SEGS, SEGS);
terrainGeo.rotateX(-Math.PI / 2);

const pos = terrainGeo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);

  const ewSlope = (x / (TERRAIN_W * 0.5));
  let y = BAS_Y + (GND_Y - BAS_Y) * (ewSlope * 0.5 + 0.5);

  if (z < -4.5) {
    const roadFactor = Math.min(1, (-z - 4.5) / 3.0);
    const extraDrop  = ewSlope < 0 ? Math.abs(ewSlope) * 0.6 * roadFactor : 0;
    y -= extraDrop;
  }

  if (z > 2.5) {
    const yardFactor = Math.min(1, (z - 2.5) / 4.0);
    y += yardFactor * 0.15;
  }

  y += Math.sin(x * 0.8 + 1.2) * 0.04 + Math.cos(z * 0.7 + 0.8) * 0.04;
  pos.setY(i, y);
}
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
  color: 0x0d1822,
  roughness: 0.95,
  metalness: 0.0,
});
const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
scene.add(terrainMesh);
terrainMesh.visible = false; // start hidden, terrain toggle turns it on

const gridHelper = new THREE.GridHelper(28, 28, 0x1e3040, 0x131d28);
gridHelper.position.y = BAS_Y + 0.01;
gridHelper.material.opacity = 0.18;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// ── ROAD EDGE LINES ──
function addLine(points, color, opacity = 0.6) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  scene.add(new THREE.Line(geo, mat));
}

addLine([
  new THREE.Vector3(-10, BAS_Y - 0.25, -5.6),
  new THREE.Vector3( 10, BAS_Y + 0.28, -5.6),
], 0x3a4a5a, 0.5);

addLine([
  new THREE.Vector3(5.0, GND_Y - 0.05, -14),
  new THREE.Vector3(5.0, GND_Y - 0.05,  10),
], 0x3a4a5a, 0.4);

const boundaryPts = [
  new THREE.Vector3(-5.5, BAS_Y + 0.12, -6.5),
  new THREE.Vector3( 4.8, GND_Y - 0.05, -6.5),
  new THREE.Vector3( 4.8, GND_Y - 0.05,  6.5),
  new THREE.Vector3(-5.5, BAS_Y + 0.06,  6.5),
  new THREE.Vector3(-5.5, BAS_Y + 0.12, -6.5),
];
addLine(boundaryPts, 0x2a3a4a, 0.35);

// ── FLOOR ACCENT COLORS ──
function floorAccentHex(floor) {
  if (floor === 'BASEMENT') return 0x00aacc;
  if (floor === 'GROUND')   return 0x33bb88;
  if (floor === 'TOP')      return 0xdd8844;
  return 0x00aacc;
}

const BASE_ROOM_COLOR = 0x1e3a55;

function baseRoomColor() { return BASE_ROOM_COLOR; }
function edgeColor(i)    { return floorAccentHex(rooms[i].floor); }

// ── BUILD ROOM MESHES ──
const roomMeshes = [];
const edgeMeshes = [];

rooms.forEach((r, i) => {
  const geo = new THREE.BoxGeometry(...r.size);
  const mat = new THREE.MeshStandardMaterial({
    color: BASE_ROOM_COLOR,
    roughness: 0.6,
    metalness: 0.15,
    transparent: true,
    opacity: 0.8,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...r.pos);
  mesh.userData = { roomIndex: i };
  scene.add(mesh);
  roomMeshes.push(mesh);

  const edges   = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: edgeColor(i),
    transparent: true,
    opacity: 0.8,
  });
  const edgeMesh = new THREE.LineSegments(edges, edgeMat);
  edgeMesh.position.set(...r.pos);
  edgeMesh.scale.setScalar(1.002);
  scene.add(edgeMesh);
  edgeMeshes.push(edgeMesh);
});

// ── FLOOR SLABS ──
const slabObjects = []; // { mesh, edge, ceilFloor }

function addSlab(cx, cy, cz, w, d, ceilFloor) {
  const geo = new THREE.BoxGeometry(w, 0.05, d);
  const mat = new THREE.MeshStandardMaterial({ color: 0x0d2030, roughness: 1, transparent: true, opacity: 1.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, cy, cz);
  scene.add(mesh);
  const el = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x2a4a60, transparent: true, opacity: 0.5 })
  );
  el.position.set(cx, cy, cz);
  scene.add(el);
  slabObjects.push({ mesh, edge: el, ceilFloor, baseMeshOpacity: 1.0, baseEdgeOpacity: 0.5 });
}
addSlab(-0.275, BAS_Y,    0.3,   5.17, 3.8, null);
addSlab(0,      BAS_Y,   -3.2,   3.6,  3.2, null);
addSlab(-0.275, GND_Y,    0.3,   5.17, 3.8, 'BASEMENT');
addSlab(0,      GND_Y,   -3.2,   3.6,  3.2, 'BASEMENT');
addSlab(-0.275, TOP_Y,    0.3,   5.17, 3.8, 'GROUND');

// ── FLOOR LABEL SPRITES ──
function makeLabel(text, color) {
  const c   = document.createElement('canvas');
  c.width = 256; c.height = 44;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 44);
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(text, 8, 30);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9, depthTest: false }));
  spr.scale.set(2.0, 0.38, 1);
  return spr;
}
const lblB = makeLabel('BASEMENT', '#00aacc');
lblB.position.set(-3.8, BAS_Y + FLOOR_H * 0.5, 0.3);
scene.add(lblB);
const lblG = makeLabel('GROUND', '#33bb88');
lblG.position.set(-3.8, GND_Y + FLOOR_H * 0.5, 0.3);
scene.add(lblG);
const lblT = makeLabel('TOP FLOOR', '#dd8844');
lblT.position.set(-3.8, TOP_Y + FLOOR_H * 0.5, 0.3);
scene.add(lblT);
const floorLabels3D = { BASEMENT: lblB, GROUND: lblG, TOP: lblT };

// ============================================================
// ORBIT CONTROLS
// ============================================================
let isDragging = false, prevX = 0, prevY = 0;
let theta = 0.7, phi = 0.72, radius = 15;
const target = new THREE.Vector3(0, 0.5, -1.5);

function updateCamera() {
  camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
  camera.position.y = target.y + radius * Math.cos(phi);
  camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
  camera.lookAt(target);
}

function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);
updateCamera();

canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
window.addEventListener('mouseup',   () => { isDragging = false; });
canvas.addEventListener('click', () => {
  if (hoveredRoom === -1 && selectedRoom !== -1) {
    selectedRoom = -1;
    document.querySelectorAll('.sensor-card').forEach(c => c.classList.remove('active'));
    const start = target.clone();
    const dest  = new THREE.Vector3(0, 0.5, -1.5);
    let t = 0; const sr = radius;
    const a = setInterval(() => {
      t = Math.min(t + 0.04, 1);
      target.lerpVectors(start, dest, t);
      radius = sr + (15 - sr) * t;
      updateCamera();
      if (t >= 1) clearInterval(a);
    }, 16);
  }
});
window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  theta -= (e.clientX - prevX) * 0.005;
  phi = Math.max(0.15, Math.min(Math.PI / 2.1, phi + (e.clientY - prevY) * 0.005));
  prevX = e.clientX; prevY = e.clientY;
  updateCamera();
});
canvas.addEventListener('wheel', e => {
  radius = Math.max(5, Math.min(22, radius + e.deltaY * 0.012));
  updateCamera();
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchstart', e => { isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; });
canvas.addEventListener('touchend',   () => { isDragging = false; });
canvas.addEventListener('touchmove',  e => {
  if (!isDragging) return;
  theta -= (e.touches[0].clientX - prevX) * 0.005;
  phi = Math.max(0.15, Math.min(Math.PI / 2.1, phi + (e.touches[0].clientY - prevY) * 0.005));
  prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
  updateCamera();
});

// ============================================================
// RAYCASTING / HOVER
// ============================================================
const raycaster = new THREE.Raycaster();
const mouse    = new THREE.Vector2();
const tooltip  = document.getElementById('tooltip');

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const visibleMeshes = roomMeshes.filter(m => m.visible);
  const hits = raycaster.intersectObjects(visibleMeshes);
  if (hits.length > 0) {
    const idx = hits[0].object.userData.roomIndex;
    if (idx !== hoveredRoom) {
      hoveredRoom = idx;
      const r = rooms[idx];
      document.getElementById('tt-name').textContent  = r.name;
      document.getElementById('tt-temp').textContent  = r.temp + '°F';
      document.getElementById('tt-humid').textContent = r.humid + '%';
      document.getElementById('tt-status').textContent =
        r.name === 'SHED'
          ? (r.humid > 55 ? '⚠ WOOD RISK' : r.humid > 45 ? 'MONITOR' : 'NOMINAL')
          : (r.humid > 65 ? 'HIGH HUMID' : r.temp > 78 ? 'WARM' : r.temp < 66 ? 'COOL' : 'NOMINAL');
    }
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX - wrap.getBoundingClientRect().left + 14) + 'px';
    tooltip.style.top  = (e.clientY - wrap.getBoundingClientRect().top  + 14) + 'px';
  } else {
    tooltip.style.display = 'none';
    hoveredRoom = -1;
  }
});
canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
canvas.addEventListener('click', () => {
  if (hoveredRoom >= 0) {
    document.querySelectorAll('.sensor-card').forEach(c => c.classList.remove('active'));
    document.getElementById('card-' + hoveredRoom)?.classList.add('active');
    document.getElementById('card-' + hoveredRoom)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    focusRoom(hoveredRoom);
  }
});

// ============================================================
// FOCUS ROOM (exported — called from dashboard.js on card click)
// ============================================================
export function focusRoom(i) {
  selectedRoom = (selectedRoom === i) ? -1 : i;
  const dest  = selectedRoom === -1
    ? new THREE.Vector3(0, 0.5, -1.5)
    : new THREE.Vector3(...rooms[i].pos);
  const start = target.clone();
  let t = 0;
  const targetRadius = selectedRoom === -1 ? 15 : 11;
  const startRadius  = radius;
  const anim = setInterval(() => {
    t = Math.min(t + 0.06, 1);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    target.lerpVectors(start, dest, ease);
    radius = startRadius + (targetRadius - startRadius) * ease;
    updateCamera();
    if (t >= 1) clearInterval(anim);
  }, 16);
}

// ============================================================
// FLOOR FILTER (exported — called from dashboard.js)
// ============================================================
function floorCenter(floor) {
  const floorRooms = rooms.filter(r => r.floor === floor);
  if (!floorRooms.length) return { x: 0, z: 0 };
  const xs = floorRooms.map(r => r.pos[0]);
  const zs = floorRooms.map(r => r.pos[2]);
  const xMin = Math.min(...xs.map((x, i) => x - floorRooms[i].size[0] / 2));
  const xMax = Math.max(...xs.map((x, i) => x + floorRooms[i].size[0] / 2));
  const zMin = Math.min(...zs.map((z, i) => z - floorRooms[i].size[2] / 2));
  const zMax = Math.max(...zs.map((z, i) => z + floorRooms[i].size[2] / 2));
  return { x: (xMin + xMax) / 2, z: (zMin + zMax) / 2,
           spanX: xMax - xMin, spanZ: zMax - zMin };
}

const floorCameraPresets = {
  ALL: { targetX: 0, targetY: 0.5, targetZ: -1.0, phi: 0.72, radius: 18 },
};
['TOP', 'GROUND', 'BASEMENT'].forEach(floor => {
  const c = floorCenter(floor);
  const span = Math.max(c.spanX || 6, c.spanZ || 6);
  floorCameraPresets[floor] = {
    targetX: c.x,
    targetY: floor === 'TOP' ? yT : floor === 'GROUND' ? yG : yB,
    targetZ: c.z,
    phi: 0.52,
    radius: Math.max(span * 1.4, 14),
  };
});

export function applyFloorFilter(activeFloor) {
  roomMeshes.forEach((m, i) => {
    const show = activeFloor === 'ALL' || rooms[i].floor === activeFloor;
    m.visible = show;
    edgeMeshes[i].visible = show;
  });
  const floorOrder = ['BASEMENT', 'GROUND', 'TOP'];
  const activeIdx  = floorOrder.indexOf(activeFloor);
  slabObjects.forEach(({ mesh, edge, ceilFloor }) => {
    const ceilIdx = floorOrder.indexOf(ceilFloor);
    const hide = activeFloor !== 'ALL' && ceilFloor !== null && ceilIdx >= activeIdx;
    mesh.visible = !hide;
    edge.visible = !hide;
  });
  Object.entries(floorLabels3D).forEach(([floor, lbl]) => {
    lbl.visible = activeFloor === 'ALL' || activeFloor === floor;
  });
}

export function flyToFloor(floor) {
  const preset = floorCameraPresets[floor] || floorCameraPresets.ALL;
  const startX = target.x, startY = target.y, startZ = target.z;
  const startPhi = phi, startRadius = radius;
  let t = 0;
  const anim = setInterval(() => {
    t = Math.min(t + 0.05, 1);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    target.x = startX + ((preset.targetX ?? 0) - startX) * ease;
    target.y = startY + (preset.targetY - startY) * ease;
    target.z = startZ + (preset.targetZ - startZ) * ease;
    phi    = startPhi    + (preset.phi    - startPhi)    * ease;
    radius = startRadius + (preset.radius - startRadius) * ease;
    updateCamera();
    if (t >= 1) clearInterval(anim);
  }, 16);
}

// ============================================================
// THERMAL MODE TOGGLE (exported — called from dashboard.js)
// ============================================================
export function setThermalMode(enabled) {
  thermalDeltaMode = enabled;
}

// ============================================================
// TERRAIN TOGGLE (exported — called from dashboard.js)
// ============================================================
export function setTerrainVisible(visible) {
  terrainMesh.visible = visible;
  gridHelper.visible  = !visible;
}

// ============================================================
// COLOR HELPERS
// ============================================================
function thermalRoomHex(i) {
  const avg   = rooms.reduce((a, r) => a + r.temp, 0) / rooms.length;
  const delta = rooms[i].temp - avg;
  const t = Math.max(-1, Math.min(1, delta / 8));
  if (t > 0.5)  return 0xff4422;
  if (t > 0.2)  return 0xff8833;
  if (t > -0.2) return 0x22aacc;
  if (t > -0.5) return 0x4488ff;
  return 0x2255dd;
}

// ============================================================
// ANIMATION LOOP
// ============================================================
let frame = 0;
function animate() {
  requestAnimationFrame(animate);
  frame++;

  roomMeshes.forEach((m, i) => {
    const isSelected  = selectedRoom === i;
    const isHovered   = hoveredRoom  === i;
    const anySelected = selectedRoom !== -1;

    const roomHex = thermalDeltaMode ? thermalRoomHex(i) : baseRoomColor();

    if (isSelected) {
      m.material.opacity = 1.0;
      m.material.color.setHex(roomHex);
      edgeMeshes[i].material.color.setHex(thermalDeltaMode ? roomHex : 0x00d4ff);
      edgeMeshes[i].material.opacity = 0.7 + 0.3 * Math.sin(frame * 0.05);
    } else if (isHovered && !anySelected) {
      m.material.opacity = thermalDeltaMode ? 1.0 : 0.8;
      m.material.color.setHex(thermalDeltaMode ? roomHex : 0x2e5a80);
      edgeMeshes[i].material.color.setHex(0xffffff);
      edgeMeshes[i].material.opacity = 1.0;
    } else if (anySelected) {
      m.material.opacity = thermalDeltaMode ? 0.25 : 0.10;
      m.material.color.setHex(roomHex);
      edgeMeshes[i].material.opacity = thermalDeltaMode ? 0.15 : 0.06;
    } else {
      m.material.opacity = thermalDeltaMode ? 0.95 : 0.8;
      m.material.color.setHex(roomHex);
      edgeMeshes[i].material.color.setHex(thermalDeltaMode ? roomHex : edgeColor(i));
      edgeMeshes[i].material.opacity = thermalDeltaMode
        ? 0.6
        : 0.55 + 0.25 * Math.sin(frame * 0.018 + i * 1.1);
    }
  });

  if (selectedRoom !== -1) {
    const selFloor  = rooms[selectedRoom].floor;
    const floorOrder = ['BASEMENT', 'GROUND', 'TOP'];
    const selIdx    = floorOrder.indexOf(selFloor);
    slabObjects.forEach(({ mesh, edge, ceilFloor }) => {
      if (ceilFloor === null) return;
      const ceilIdx    = floorOrder.indexOf(ceilFloor);
      const shouldFade = ceilIdx >= selIdx;
      mesh.material.opacity = shouldFade ? 0.04 : 1.0;
      edge.material.opacity = shouldFade ? 0.02 : 0.5;
    });
  } else {
    slabObjects.forEach(({ mesh, edge, ceilFloor }) => {
      if (ceilFloor === null) return;
      mesh.material.opacity = 1.0;
      edge.material.opacity = 0.5;
    });
  }

  if (!isDragging) { theta += 0.0008; updateCamera(); }
  renderer.render(scene, camera);
}

animate();
