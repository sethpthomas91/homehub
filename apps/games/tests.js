// Crossword engine tests.
// Pure vanilla JS — no frameworks.
// Loaded by tests.html after puzzles/puzzles.js, so PUZZLES is available.

// ---------------------------------------------------------------------------
// Functions under test (pure copies for isolation — no DOM, no global state)
// ---------------------------------------------------------------------------

function numberCells(grid, rows = 5, cols = 5) {
  const nums = {};
  let n = 1;
  for (let i = 0; i < rows * cols; i++) {
    if (grid[i] === '#') continue;
    const row = Math.floor(i / cols), col = i % cols;
    const startsAcross = (col === 0 || grid[i - 1] === '#') && col < cols - 1 && grid[i + 1] !== '#';
    const startsDown   = (row === 0 || grid[i - cols] === '#') && row < rows - 1 && grid[i + cols] !== '#';
    if (startsAcross || startsDown) nums[i] = n++;
  }
  return nums;
}

function getPuzzleIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return dayOfYear % PUZZLES.length;
}

function buildWords(grid, cellNums, rows = 5, cols = 5) {
  const words = [];
  const cellWordMap = {};
  for (let i = 0; i < rows * cols; i++) {
    if (grid[i] !== '#') cellWordMap[i] = {};
  }
  for (const [idxStr, num] of Object.entries(cellNums)) {
    const idx = parseInt(idxStr, 10);
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const startsAcross = (col === 0 || grid[idx - 1] === '#') && col < cols - 1 && grid[idx + 1] !== '#';
    if (startsAcross) {
      const cells = [];
      for (let j = idx; j < rows * cols && Math.floor(j / cols) === row && grid[j] !== '#'; j++) cells.push(j);
      const key = `across-${num}`;
      words.push({ key, dir: 'across', num, cells, answer: cells.map(c => grid[c]).join('') });
      cells.forEach(c => { cellWordMap[c].across = key; });
    }
    const startsDown = (row === 0 || grid[idx - cols] === '#') && row < rows - 1 && grid[idx + cols] !== '#';
    if (startsDown) {
      const cells = [];
      for (let j = idx; j < rows * cols && grid[j] !== '#'; j += cols) cells.push(j);
      const key = `down-${num}`;
      words.push({ key, dir: 'down', num, cells, answer: cells.map(c => grid[c]).join('') });
      cells.forEach(c => { cellWordMap[c].down = key; });
    }
  }
  return { words, cellWordMap };
}

// letters is a plain object { cellIndex: 'A', ... }
function isWordComplete(word, letters) {
  return word.cells.every((c, i) => letters[c] === word.answer[i]);
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const results = [];

function assert(description, condition) {
  results.push({ description, passed: !!condition });
}

// ---------------------------------------------------------------------------
// numberCells — all 3 puzzle grids
// ---------------------------------------------------------------------------

// Puzzle 1: grid = 'CATERA###AB###CI###EN###S'
// Numbered cells: 0 (starts across+down → #1), 4 (starts down → #2)
const nums1 = numberCells('CATERA###AB###CI###EN###S');
assert('P1 numberCells: cell 0 = 1', nums1[0] === 1);
assert('P1 numberCells: cell 4 = 2', nums1[4] === 2);
assert('P1 numberCells: exactly 2 numbered cells', Object.keys(nums1).length === 2);
assert('P1 numberCells: non-start cells not numbered', nums1[1] === undefined && nums1[5] === undefined && nums1[10] === undefined);

// Puzzle 2: grid = 'STEAMT###AO###PN###LE###E'
const nums2 = numberCells('STEAMT###AO###PN###LE###E');
assert('P2 numberCells: cell 0 = 1', nums2[0] === 1);
assert('P2 numberCells: cell 4 = 2', nums2[4] === 2);
assert('P2 numberCells: exactly 2 numbered cells', Object.keys(nums2).length === 2);

// Puzzle 3: grid = 'FLAMER###NO###DG###ES###D'
const nums3 = numberCells('FLAMER###NO###DG###ES###D');
assert('P3 numberCells: cell 0 = 1', nums3[0] === 1);
assert('P3 numberCells: cell 4 = 2', nums3[4] === 2);
assert('P3 numberCells: exactly 2 numbered cells', Object.keys(nums3).length === 2);

// Black squares must never be numbered
assert('numberCells: black squares not numbered (P1)', nums1[5] === undefined && nums1[6] === undefined && nums1[9] === undefined);

// ---------------------------------------------------------------------------
// getPuzzleIndex
// ---------------------------------------------------------------------------

const pidx = getPuzzleIndex();
assert('getPuzzleIndex: returns a number', typeof pidx === 'number');
assert('getPuzzleIndex: is a non-negative integer', Number.isInteger(pidx) && pidx >= 0);
assert('getPuzzleIndex: is within PUZZLES.length', pidx < PUZZLES.length);

// Deterministic for same day — calling twice gives the same result
assert('getPuzzleIndex: deterministic within same day', getPuzzleIndex() === getPuzzleIndex());

// ---------------------------------------------------------------------------
// isWordComplete
// ---------------------------------------------------------------------------

const { words: words1 } = buildWords('CATERA###AB###CI###EN###S', nums1);
const across1 = words1.find(w => w.key === 'across-1'); // CATER, cells [0,1,2,3,4]
const down1   = words1.find(w => w.key === 'down-1');   // CABIN, cells [0,5,10,15,20]
const down2   = words1.find(w => w.key === 'down-2');   // RACES, cells [4,9,14,19,24]

// Fully correct
assert('isWordComplete: CATER all correct → true',
  isWordComplete(across1, { 0:'C', 1:'A', 2:'T', 3:'E', 4:'R' }));

assert('isWordComplete: CABIN all correct → true',
  isWordComplete(down1, { 0:'C', 5:'A', 10:'B', 15:'I', 20:'N' }));

assert('isWordComplete: RACES all correct → true',
  isWordComplete(down2, { 4:'R', 9:'A', 14:'C', 19:'E', 24:'S' }));

// Missing one letter
assert('isWordComplete: CATER missing last letter → false',
  !isWordComplete(across1, { 0:'C', 1:'A', 2:'T', 3:'E' }));

// Wrong letter
assert('isWordComplete: CATER wrong last letter → false',
  !isWordComplete(across1, { 0:'C', 1:'A', 2:'T', 3:'E', 4:'X' }));

// Empty letters object
assert('isWordComplete: empty letters → false',
  !isWordComplete(across1, {}));

// Correct word but extra unrelated letters don't matter
assert('isWordComplete: correct word ignores unrelated cells',
  isWordComplete(across1, { 0:'C', 1:'A', 2:'T', 3:'E', 4:'R', 99:'Z' }));

// Case sensitive — answers are uppercase, so lowercase should fail
assert('isWordComplete: lowercase letters → false',
  !isWordComplete(across1, { 0:'c', 1:'a', 2:'t', 3:'e', 4:'r' }));

// ---------------------------------------------------------------------------
// Grid intersection validation — all puzzles
// ---------------------------------------------------------------------------

for (const puzzle of PUZZLES) {
  const cellNums = numberCells(puzzle.grid, puzzle.rows, puzzle.cols);
  const { words, cellWordMap } = buildWords(puzzle.grid, cellNums, puzzle.rows, puzzle.cols);

  // Every non-black cell that belongs to both an across and a down word must
  // have matching letters in both answers at the intersection position.
  for (let i = 0; i < puzzle.rows * puzzle.cols; i++) {
    if (puzzle.grid[i] === '#') continue;
    const acKey = cellWordMap[i]?.across;
    const dnKey = cellWordMap[i]?.down;
    if (!acKey || !dnKey) continue;

    const acWord = words.find(w => w.key === acKey);
    const dnWord = words.find(w => w.key === dnKey);
    const acLetter = acWord.answer[acWord.cells.indexOf(i)];
    const dnLetter = dnWord.answer[dnWord.cells.indexOf(i)];

    assert(
      `${puzzle.title}: cell ${i} intersection — across '${acLetter}' matches down '${dnLetter}'`,
      acLetter === dnLetter
    );
  }
}

// ---------------------------------------------------------------------------
// Render results into DOM
// ---------------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('results');
  let passed = 0, failed = 0;

  results.forEach(r => {
    const li = document.createElement('li');
    li.className = r.passed ? 'pass' : 'fail';
    li.textContent = (r.passed ? '✓  ' : '✗  ') + r.description;
    list.appendChild(li);
    if (r.passed) passed++; else failed++;
  });

  const summary = document.getElementById('summary');
  summary.textContent = failed === 0
    ? `All ${passed} tests passed`
    : `${passed} passed · ${failed} failed`;
  summary.className = failed === 0 ? 'all-pass' : 'has-fail';
});
