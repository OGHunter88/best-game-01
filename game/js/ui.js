// The DOM around the canvas: the HUD bar, the tower shop sidebar, the
// title / victory / defeat / pause overlays, and mouse + keyboard input.
// It talks to the Game through its public methods and never touches
// game state directly.

import { BOARD, MAX_WAVE, SELL_RATE, TOWER_TYPES } from './config.js';
import { PHASE_BUILD, PHASE_OVER, PHASE_TITLE, PHASE_WAVE } from './game.js';
import { totalInvested } from './towers.js';

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
}

function formatNumber(value) {
  return value.toLocaleString('en-US');
}

export class UI {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.toastTimer = null;
    this.buildShop();
    this.bindButtons();
    this.bindCanvas();
    this.bindKeyboard();
    this.showOverlay(PHASE_TITLE);
    this.updateHud(game.hud());
  }

  // --- shop sidebar -----------------------------------------------------

  buildShop() {
    const shop = el('shop');
    shop.innerHTML = '';
    for (const [type, def] of Object.entries(TOWER_TYPES)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'tower-card';
      card.dataset.tower = type;
      card.innerHTML = `
        <span class="tower-swatch" style="background:${def.color}"></span>
        <span class="tower-name">${def.name}</span>
        <span class="tower-cost">${def.cost}g</span>
        <span class="tower-blurb">${def.blurb}</span>
        <span class="tower-stats">Range ${def.range} · ${def.rate}/s · ${def.damage} dmg${def.splash ? ` · splash ${def.splash}` : ''}${def.slowFactor ? ` · slows ${Math.round((1 - def.slowFactor) * 100)}%` : ''}</span>`;
      card.addEventListener('click', () => {
        this.game.sound.unlock();
        this.game.selectShop(type);
        this.updateHud(this.game.hud());
      });
      shop.appendChild(card);
    }
    el('btn-upgrade').addEventListener('click', () => {
      if (this.game.selectedTower) this.game.upgradeTower(this.game.selectedTower);
    });
    el('btn-sell').addEventListener('click', () => {
      if (this.game.selectedTower) this.game.sellTower(this.game.selectedTower);
    });
  }

  // --- buttons ----------------------------------------------------------

  bindButtons() {
    el('btn-wave').addEventListener('click', () => {
      this.game.sound.unlock();
      this.game.startWave();
      this.updateHud(this.game.hud());
    });
    el('btn-speed').addEventListener('click', () => {
      this.game.toggleSpeed();
      this.updateHud(this.game.hud());
    });
    el('btn-pause').addEventListener('click', () => {
      this.game.togglePause();
      this.updateHud(this.game.hud());
    });
    el('btn-sound').addEventListener('click', () => {
      const muted = !this.game.sound.muted;
      this.game.sound.setMuted(muted);
      el('btn-sound').textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
    });
    el('btn-start').addEventListener('click', () => this.game.startGame());
    el('btn-restart-win').addEventListener('click', () => this.game.startGame());
    el('btn-restart-lose').addEventListener('click', () => this.game.startGame());
    el('btn-resume').addEventListener('click', () => {
      this.game.togglePause();
      this.updateHud(this.game.hud());
    });
    el('btn-howto').addEventListener('click', () => {
      el('howto').classList.toggle('open');
    });
  }

  // --- canvas input -----------------------------------------------------

  canvasCell(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = BOARD.width / rect.width;
    const scaleY = BOARD.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const col = Math.floor(x / BOARD.cell);
    const row = Math.floor(y / BOARD.cell);
    if (col < 0 || col >= BOARD.cols || row < 0 || row >= BOARD.rows) return null;
    return { col, row };
  }

  bindCanvas() {
    this.canvas.addEventListener('mousemove', (event) => {
      this.game.hoverCell = this.canvasCell(event);
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.game.hoverCell = null;
    });
    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.game.clearSelection();
    });
    this.canvas.addEventListener('click', (event) => {
      this.game.sound.unlock();
      const cell = this.canvasCell(event);
      if (!cell) return;
      if (this.game.phase !== PHASE_BUILD && this.game.phase !== PHASE_WAVE) return;
      const placed = this.game.towerAt(cell.col, cell.row);
      if (this.game.selectedTowerType) {
        if (placed) {
          this.game.selectPlaced(placed);
        } else {
          this.game.buildTower(this.game.selectedTowerType, cell.col, cell.row);
        }
      } else if (placed) {
        this.game.selectPlaced(placed);
      } else {
        this.game.clearSelection();
      }
      this.updateHud(this.game.hud());
    });
  }

  bindKeyboard() {
    document.addEventListener('keydown', (event) => {
      if (this.game.phase === PHASE_TITLE) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.game.startGame();
        }
        return;
      }
      if (event.key === 'Escape') {
        this.game.clearSelection();
        return;
      }
      if (event.key === '1') this.game.selectShop('spark');
      if (event.key === '2') this.game.selectShop('frost');
      if (event.key === '3') this.game.selectShop('cannon');
      if (event.key === ' ' && this.game.phase === PHASE_BUILD) {
        event.preventDefault();
        this.game.startWave();
      }
      if (event.key === 'p' || event.key === 'P') this.game.togglePause();
      if (event.key === 'f' || event.key === 'F') this.game.toggleSpeed();
      if (event.key === 'm' || event.key === 'M') {
        const muted = !this.game.sound.muted;
        this.game.sound.setMuted(muted);
        el('btn-sound').textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
      }
      if (event.key === 'r' || event.key === 'R') this.game.startGame();
      this.updateHud(this.game.hud());
    });
  }

  // --- HUD + overlays ---------------------------------------------------

  updateHud(hud) {
    el('hud-gold').textContent = `${formatNumber(hud.gold)}g`;
    el('hud-lives').textContent = `❤ ${hud.lives}`;
    el('hud-wave').textContent = hud.wave >= MAX_WAVE ? 'Done!' : `Wave ${hud.wave + 1}/${MAX_WAVE}`;
    el('hud-score').textContent = formatNumber(hud.score);
    el('hud-enemies').textContent = hud.phase === PHASE_WAVE ? `👾 ${hud.enemiesLeft} left` : '';
    el('btn-speed').textContent = hud.speed === 1 ? '▶ 1×' : '⏩ 2×';
    el('btn-pause').textContent = hud.paused ? '▶ Resume' : '⏸ Pause';
    const waveButton = el('btn-wave');
    waveButton.disabled = hud.phase !== PHASE_BUILD;
    waveButton.textContent = hud.phase === PHASE_BUILD
      ? (hud.wave === 0 ? '⚔ Start Wave 1' : `⚔ Start Wave ${hud.wave + 1}`)
      : hud.phase === PHASE_WAVE ? 'Wave running…' : '⚔ Start Wave';
    // Shop card selection highlight.
    for (const card of document.querySelectorAll('.tower-card')) {
      card.classList.toggle('selected', card.dataset.tower === this.game.selectedTowerType);
    }
    // Selected-tower panel.
    const panel = el('selected-panel');
    const tower = this.game.selectedTower;
    if (tower) {
      panel.classList.remove('hidden');
      el('sel-name').textContent = `${tower.def.name} · Lv ${tower.level}`;
      el('sel-stats').textContent = `Damage ${Math.round(tower.damage)} · Range ${Math.round(tower.range)} · ${tower.kills} kills`;
      const upgrade = el('btn-upgrade');
      upgrade.disabled = tower.upgradeCost === null;
      upgrade.textContent = tower.upgradeCost === null ? 'Max level' : `⬆ Upgrade (${tower.upgradeCost}g)`;
      el('btn-sell').textContent = `Sell (+${Math.round(totalInvested(tower) * SELL_RATE)}g)`;
    } else {
      panel.classList.add('hidden');
    }
    // Pause overlay follows the paused flag.
    if (hud.paused && (hud.phase === PHASE_BUILD || hud.phase === PHASE_WAVE)) {
      this.showOverlay('pause');
    } else if (!hud.paused) {
      this.hideOverlay('pause');
    }
  }

  showToast(message) {
    const toast = el('toast');
    toast.textContent = message;
    toast.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
  }

  showOverlay(name) {
    for (const overlay of document.querySelectorAll('.overlay')) overlay.classList.add('hidden');
    const target = el(`overlay-${name}`);
    if (target) target.classList.remove('hidden');
    if (name === 'win') {
      el('win-stats').textContent =
        `Score ${formatNumber(this.game.score)} · ${this.game.kills} creatures stopped · ${this.game.leaks} leaked · Crystal ${this.game.lives}❤ left`;
    }
    if (name === 'lose') {
      el('lose-stats').textContent =
        `You fell on Wave ${this.game.wave + 1} · Score ${formatNumber(this.game.score)} · ${this.game.kills} creatures stopped`;
    }
  }

  hideOverlay(name) {
    const target = el(`overlay-${name}`);
    if (target) target.classList.add('hidden');
  }

  onPhase(phase) {
    if (phase === PHASE_TITLE) this.showOverlay('title');
    else if (phase === PHASE_OVER) this.showOverlay(this.game.victory ? 'win' : 'lose');
    else {
      this.hideOverlay('title');
      this.hideOverlay('win');
      this.hideOverlay('lose');
    }
    this.updateHud(this.game.hud());
  }
}
