// Emberfall Keep — the board and the waves.
//
// One job: where the road runs, which cells can hold a tower, and what
// each of the twelve waves throws at the Keep. No logic lives here, only
// the level's shape and the wave table.

import { BOARD, CRYSTAL_CELL, MAX_WAVE, PATH_WAYPOINTS, waveHpMultiplier } from './config.js';

// Every cell the road touches, as "col,row" strings.
export function computePathCells() {
  const cells = new Set();
  for (let index = 0; index < PATH_WAYPOINTS.length - 1; index += 1) {
    const [colA, rowA] = PATH_WAYPOINTS[index];
    const [colB, rowB] = PATH_WAYPOINTS[index + 1];
    const stepCol = Math.sign(colB - colA);
    const stepRow = Math.sign(rowB - rowA);
    let col = colA;
    let row = rowA;
    while (true) {
      if (col >= 0 && col < BOARD.cols && row >= 0 && row < BOARD.rows) cells.add(`${col},${row}`);
      if (col === colB && row === rowB) break;
      col += stepCol;
      row += stepRow;
    }
  }
  return cells;
}

// The road as pixel waypoints (cell centres), for enemies to walk.
export function computePathPoints() {
  return PATH_WAYPOINTS.map(([col, row]) => ({
    x: (col + 0.5) * BOARD.cell,
    y: (row + 0.5) * BOARD.cell,
  }));
}

export function isPathCell(cells, col, row) {
  return cells.has(`${col},${row}`);
}

export function isCrystalCell(col, row) {
  return col === CRYSTAL_CELL.col && row === CRYSTAL_CELL.row;
}

export function isBuildableCell(cells, col, row) {
  if (col < 0 || col >= BOARD.cols || row < 0 || row >= BOARD.rows) return false;
  if (isPathCell(cells, col, row)) return false;
  if (isCrystalCell(col, row)) return false;
  return true;
}

// Where the autopilot (and the screenshot scenes) prefer to build, best
// first: cells hugging the long straights and the corners, where one tower
// covers the most road.
export const PREFERRED_BUILD_CELLS = [
  [12, 2], [5, 2], [9, 2], [1, 2], [14, 2],
  [12, 3], [5, 3], [9, 3], [1, 3], [14, 3],
  [12, 5], [5, 5], [9, 5], [1, 5], [14, 5],
  [12, 6], [5, 6], [9, 6], [1, 6], [14, 6],
  [3, 3], [3, 5], [3, 6], [3, 8], [11, 2], [11, 3],
  [11, 5], [11, 6], [11, 8], [0, 0], [4, 0], [8, 0],
  [4, 8], [8, 8], [0, 5], [0, 6], [4, 9], [8, 9],
  [6, 0], [10, 0], [6, 9], [10, 9], [14, 0], [14, 9],
];

// One spawn group: `count` enemies of one kind, `gap` seconds apart,
// starting `delay` seconds into the wave.
function group(type, count, gap, delay = 0) {
  return { type, count, gap, delay };
}

// The twelve waves. Early waves teach one enemy at a time; the middle
// waves mix speeds so no single tower answers everything; waves 6 and 9
// bring a Brute each, and wave 12 brings the Ash Golem with an escort.
export function buildWaves() {
  const waves = [
    { groups: [group('wisp', 8, 0.9)] },
    { groups: [group('wisp', 12, 0.7)] },
    { groups: [group('wisp', 10, 0.6), group('skitter', 6, 0.5, 4)] },
    { groups: [group('husk', 6, 1.2), group('wisp', 10, 0.5, 5)] },
    { groups: [group('skitter', 14, 0.4), group('wisp', 8, 0.5, 4)] },
    { groups: [group('brute', 1, 1, 0), group('wisp', 12, 0.5, 3)] },
    { groups: [group('wisp', 22, 0.4), group('skitter', 14, 0.3, 5), group('husk', 8, 0.9, 9)] },
    { groups: [group('husk', 14, 0.8), group('wraith', 12, 0.6, 6)] },
    { groups: [group('brute', 2, 3, 0), group('skitter', 20, 0.3, 4)] },
    { groups: [group('wisp', 28, 0.35), group('wraith', 16, 0.5, 6), group('husk', 12, 0.8, 10)] },
    { groups: [group('brute', 4, 2.2, 0), group('skitter', 22, 0.28, 4), group('wraith', 14, 0.45, 8)] },
    { groups: [group('golem', 1, 1, 0), group('wisp', 18, 0.4, 5), group('husk', 12, 0.8, 9), group('brute', 2, 6, 14)] },
  ];
  if (waves.length !== MAX_WAVE) throw new Error(`expected ${MAX_WAVE} waves, got ${waves.length}`);
  return waves.map((wave, index) => ({
    number: index + 1,
    hpMultiplier: waveHpMultiplier(index + 1),
    groups: wave.groups,
  }));
}
