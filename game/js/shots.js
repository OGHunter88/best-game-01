// Screenshot scenes (?shot=start|build|play|end, &seed=N).
//
// Each scene plays the real rules forward from a fresh game, steered by
// the game's own autopilot, so the frame is what a short game really
// looks like — and the same seed always gives the same frame.

import { Enemy } from './enemies.js';
import { PHASE_OVER } from './game.js';
import { makeRng } from './rng.js';

const STEP = 1 / 60;

function runSteps(game, seconds, until = null) {
  const steps = Math.ceil(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    game.autopilotStep();
    game.update(STEP);
    if (until && until(game)) break;
    if (game.phase === PHASE_OVER) break;
  }
}

// Towers placed by hand, so the title and build scenes sit over a board
// that already looks defended. Temporarily rich, then gold is restored.
function dressBoard(game) {
  game.gold = 2000;
  const placements = [
    ['spark', 12, 2], ['spark', 5, 2], ['frost', 9, 2],
    ['cannon', 12, 5], ['spark', 5, 5], ['frost', 1, 3],
    ['spark', 9, 6], ['cannon', 3, 5],
  ];
  for (const [type, col, row] of placements) game.buildTower(type, col, row);
  game.gold = 200;
}

// A few creatures strolling the road behind the title card: created at
// the gate and walked forward different distances, then left frozen.
function dressRoad(game) {
  const strolls = [
    ['wisp', 6], ['wisp', 13], ['skitter', 18], ['wisp', 24], ['husk', 9],
  ];
  for (const [type, seconds] of strolls) {
    const enemy = new Enemy(type, 1, game.pathPoints);
    const steps = Math.ceil(seconds / STEP);
    for (let index = 0; index < steps; index += 1) {
      if (enemy.update(STEP, index * STEP) === 'leaked') break;
    }
    game.enemies.push(enemy);
  }
}

/**
 * Set the game to the named scene and return the overlay to show:
 * 'title' for start, null for the build/play scenes (no overlay),
 * 'end' for the victory/defeat screen.
 */
export function stageShot(name, game) {
  game.reset();
  const seed = Number(new URLSearchParams(window.location.search).get('seed') || '1');
  game.rng = makeRng(seed);

  if (name === 'start') {
    game.startGame();
    dressBoard(game);
    dressRoad(game);
    return 'title';
  }
  if (name === 'build') {
    game.startGame();
    dressBoard(game);
    // A cannon chosen in the shop, hovering a free cell beside the road,
    // so the frame shows the range ring and the placement ghost.
    game.selectShop('cannon');
    game.hoverCell = { col: 12, row: 6 };
    return null;
  }
  if (name === 'play') {
    game.startGame();
    // Play forward until wave 3 is running with creatures on the road.
    runSteps(game, 150, (state) => state.phase === 'wave' && state.wave === 2 && state.enemies.length >= 4);
    return null;
  }
  // 'end' (and anything else): play the whole game out with the autopilot.
  game.startGame();
  runSteps(game, 1500);
  return 'end';
}
