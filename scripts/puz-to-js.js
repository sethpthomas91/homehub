#!/usr/bin/env node
// puz-to-js.js — Convert Across Lite .puz files to puzzles.js
// Usage: node scripts/puz-to-js.js
// Reads:  apps/games/puzzles/manifest.json
//         apps/games/puzzles/source/<file>.puz  (for each entry)
// Writes: apps/games/puzzles/puzzles.js

'use strict';

const fs   = require('fs');
const path = require('path');

const MANIFEST_PATH = path.resolve(__dirname, '../apps/games/puzzles/manifest.json');
const SOURCE_DIR    = path.resolve(__dirname, '../apps/games/puzzles/source');
const OUTPUT_PATH   = path.resolve(__dirname, '../apps/games/puzzles/puzzles.js');

// ---------------------------------------------------------------------------
// .puz binary parser
// ---------------------------------------------------------------------------
function parsePuz(buf) {
  // Fixed header is 52 (0x34) bytes
  // 0x2C = width, 0x2D = height, 0x2E-0x2F = numClues (little-endian)
  const width    = buf[0x2C];
  const height   = buf[0x2D];
  const numClues = buf.readUInt16LE(0x2E);
  const size     = width * height;

  if (width !== 5 || height !== 5) {
    return null; // caller will warn
  }

  // Solution grid starts at byte 0x34
  const solutionBytes = buf.slice(0x34, 0x34 + size);
  const solution = solutionBytes.toString('latin1'); // '.' = black square in .puz

  // Convert '.' black squares to '#' (engine convention)
  const grid = solution.replace(/\./g, '#');

  // Skip state grid (same size), then read null-terminated strings
  let offset = 0x34 + size * 2;

  function readString() {
    const end = buf.indexOf(0x00, offset);
    const s   = buf.slice(offset, end).toString('latin1');
    offset    = end + 1;
    return s;
  }

  const title     = readString();
  readString(); // author — not used
  readString(); // copyright — not used

  const rawClues = [];
  for (let i = 0; i < numClues; i++) {
    rawClues.push(readString());
  }

  return { grid, title, rawClues };
}

// ---------------------------------------------------------------------------
// Numbering — mirrors the algorithm in index.html
// ---------------------------------------------------------------------------
function numberCells(grid) {
  const nums = {};
  let n = 1;
  for (let i = 0; i < 25; i++) {
    if (grid[i] === '#') continue;
    const row = Math.floor(i / 5);
    const col = i % 5;
    const startsAcross = (col === 0 || grid[i - 1] === '#') && col < 4 && grid[i + 1] !== '#';
    const startsDown   = (row === 0 || grid[i - 5] === '#') && row < 4 && grid[i + 5] !== '#';
    if (startsAcross || startsDown) nums[i] = n++;
  }
  return nums;
}

// ---------------------------------------------------------------------------
// Assign raw clues (in .puz reading order) to across/down by clue number
// ---------------------------------------------------------------------------
function assignClues(grid, rawClues) {
  const nums = numberCells(grid);
  const across = {};
  const down   = {};
  let clueIdx  = 0;

  // .puz stores clues in cell-number order: across entries first for each
  // numbered cell, then down — but actually it's interleaved: for each cell
  // in reading order that starts a word, across comes before down.
  for (const [idxStr, num] of Object.entries(nums).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    const idx = parseInt(idxStr, 10);
    const row = Math.floor(idx / 5);
    const col = idx % 5;

    const startsAcross = (col === 0 || grid[idx - 1] === '#') && col < 4 && grid[idx + 1] !== '#';
    const startsDown   = (row === 0 || grid[idx - 5] === '#') && row < 4 && grid[idx + 5] !== '#';

    if (startsAcross) across[num] = rawClues[clueIdx++] || '';
    if (startsDown)   down[num]   = rawClues[clueIdx++] || '';
  }

  return { across, down };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
manifest.sort((a, b) => a.slot - b.slot);

const puzzles = [];
let ok = true;

for (const entry of manifest) {
  const filePath = path.join(SOURCE_DIR, entry.file);

  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: file not found: ${filePath}`);
    ok = false;
    continue;
  }

  const buf    = fs.readFileSync(filePath);
  const parsed = parsePuz(buf);

  if (!parsed) {
    console.warn(`SKIP (not 5×5): slot ${entry.slot} — ${entry.file}`);
    continue;
  }

  const title = entry.title || parsed.title || `Puzzle ${entry.slot}`;
  const { across, down } = assignClues(parsed.grid, parsed.rawClues);

  puzzles.push({ title, grid: parsed.grid, clues: { across, down } });
  console.log(`OK  slot ${entry.slot}: "${title}" (${parsed.rawClues.length} clues)`);
}

if (!ok) {
  console.error('\nAborting — fix errors above before writing output.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Emit puzzles.js
// ---------------------------------------------------------------------------
function jsonClues(clueMap) {
  const entries = Object.entries(clueMap)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([k, v]) => `        ${k}: ${JSON.stringify(v)}`)
    .join(',\n');
  return `{\n${entries}\n      }`;
}

const lines = [
  '// puzzles.js — generated by scripts/puz-to-js.js — do not edit by hand',
  "// Source: apps/games/puzzles/source/  Manifest: apps/games/puzzles/manifest.json",
  '',
  'const PUZZLES = [',
];

for (let i = 0; i < puzzles.length; i++) {
  const p = puzzles[i];
  const comma = i < puzzles.length - 1 ? ',' : '';
  lines.push('  {');
  lines.push(`    title: ${JSON.stringify(p.title)},`);
  lines.push(`    grid:  ${JSON.stringify(p.grid)},`);
  lines.push('    clues: {');
  lines.push(`      across: ${jsonClues(p.clues.across)},`);
  lines.push(`      down:   ${jsonClues(p.clues.down)}`);
  lines.push('    }');
  lines.push('  }' + comma);
}

lines.push('];', '');

fs.writeFileSync(OUTPUT_PATH, lines.join('\n'));
console.log(`\nWrote ${puzzles.length} puzzle(s) to ${OUTPUT_PATH}`);
