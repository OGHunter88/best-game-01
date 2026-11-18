// Emberfall Keep — boot. Wires the game, the renderer and the DOM
// together, runs the frame loop, and stages the ?shot= scenes that the
// screenshots are taken from (a staged scene draws one frozen frame).

import { Game, PHASE_OVER } from './game.js';
import { Renderer } from './render.js';
import { stageShot } from './shots.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game');
const game = new Game({
  hooks: {
    onHud: (hud) => ui.updateHud(hud),
    onToast: (message) => ui.showToast(message),
    onPhase: (phase) => ui.onPhase(phase),
    onSelect: () => ui.updateHud(game.hud()),
  },
});
const renderer = new Renderer(canvas);
const ui = new UI(game, canvas);

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  // Screenshot mode: stage the scene, draw it once, and hold the frame.
  const overlay = stageShot(shot, game);
  ui.updateHud(game.hud());
  if (overlay === 'title') ui.showOverlay('title');
  else if (overlay === 'end') ui.showOverlay(game.victory ? 'win' : 'lose');
  else {
    ui.hideOverlay('title');
    ui.hideOverlay('win');
    ui.hideOverlay('lose');
  }
  renderer.draw(game, 0);
  document.title = `Emberfall Keep — shot: ${shot}`;
} else {
  // Normal play: fixed-step logic, render every animation frame.
  let last = performance.now();
  let accumulator = 0;
  const STEP = 1 / 60;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      game.update(STEP);
      accumulator -= STEP;
      if (game.phase === PHASE_OVER) accumulator = 0;
    }
    renderer.draw(game, elapsed);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
