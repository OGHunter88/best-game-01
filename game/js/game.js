// Emberfall Keep — the game itself: state, economy, waves, building,
// combat resolution, and the autopilot that plays it for screenshots
// and for the headless balance check. No DOM and no canvas in here:
// ui.js owns the DOM, render.js owns the canvas, and both read this.

import {
  BOARD,
  MAX_WAVE,
  SELL_RATE,
  START_GOLD,
  START_LIVES,
  TOWER_TYPES,
  WAVE_CLEAR_BONUS,
} from './config.js';
import { Enemy } from './enemies.js';
import { SoundBank } from './audio.js';
import { buildWaves, computePathCells, computePathPoints, isBuildableCell, PREFERRED_BUILD_CELLS } from './levels.js';
import { ParticleSystem } from './particles.js';
import { Tower, totalInvested } from './towers.js';
import { liveRng } from './rng.js';

export const PHASE_TITLE = 'title';
export const PHASE_BUILD = 'build';
export const PHASE_WAVE = 'wave';
export const PHASE_OVER = 'over';

const STEP = 1 / 60;

export class Game {
  constructor({ rng = liveRng(), sound = new SoundBank(), hooks = {} } = {}) {
    this.rng = rng;
    this.sound = sound;
    // Hooks the UI fills in; every one is optional and defaults to a no-op.
    this.hooks = {
      onHud: () => {},
      onToast: () => {},
      onPhase: () => {},
      onSelect: () => {},
      ...hooks,
    };
    this.pathCells = computePathCells();
    this.pathPoints = computePathPoints();
    this.waves = buildWaves();
    this.particles = new ParticleSystem();
    this.reset();
  }

  reset() {
    this.phase = PHASE_TITLE;
    this.paused = false;
    this.speed = 1; // 1x or 2x
    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.score = 0;
    this.wave = 0; // waves cleared; the running wave is wave + 1
    this.kills = 0;
    this.leaks = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.spawnQueue = []; // {at, type} sorted by time, game-clock seconds
    this.waveTime = 0;
    this.time = 0;
    this.victory = false;
    this.selectedTowerType = null; // shop selection: 'spark' | 'frost' | 'cannon'
    this.selectedTower = null; // placed tower selected on the board
    this.hoverCell = null; // {col,row} under the mouse, or null
    this.particles.clear();
    this.hooks.onPhase(this.phase);
    this.hooks.onHud(this.hud());
    this.hooks.onSelect(null, null);
  }

  hud() {
    return {
      gold: this.gold,
      lives: this.lives,
      score: this.score,
      wave: this.wave,
      maxWave: MAX_WAVE,
      enemiesLeft: this.enemies.filter((enemy) => !enemy.dead && !enemy.leaked).length + this.spawnQueue.length,
      phase: this.phase,
      speed: this.speed,
      paused: this.paused,
    };
  }

  startGame() {
    this.reset();
    this.phase = PHASE_BUILD;
    this.sound.unlock();
    this.sound.startMusic();
    this.hooks.onPhase(this.phase);
    this.hooks.onHud(this.hud());
    this.hooks.onToast('Build your defences, then start Wave 1.');
  }

  // --- building ---------------------------------------------------------

  towerAt(col, row) {
    return this.towers.find((tower) => tower.col === col && tower.row === row) ?? null;
  }

  canBuild(col, row) {
    return isBuildableCell(this.pathCells, col, row) && this.towerAt(col, row) === null;
  }

  buildTower(type, col, row) {
    if (this.phase !== PHASE_BUILD && this.phase !== PHASE_WAVE) return false;
    if (!this.canBuild(col, row)) {
      this.sound.denied();
      return false;
    }
    const cost = TOWER_TYPES[type].cost;
    if (this.gold < cost) {
      this.sound.denied();
      this.hooks.onToast(`Not enough gold for a ${TOWER_TYPES[type].name} (${cost}g).`);
      return false;
    }
    this.gold -= cost;
    const tower = new Tower(type, col, row);
    this.towers.push(tower);
    this.sound.place();
    this.particles.ring(tower.x, tower.y, TOWER_TYPES[type].glow);
    this.hooks.onHud(this.hud());
    return true;
  }

  upgradeTower(tower) {
    const cost = tower.upgradeCost;
    if (cost === null) {
      this.hooks.onToast('That tower is already at max level.');
      return false;
    }
    if (this.gold < cost) {
      this.sound.denied();
      this.hooks.onToast(`Upgrade needs ${cost}g.`);
      return false;
    }
    this.gold -= cost;
    tower.level += 1;
    this.sound.upgrade();
    this.particles.ring(tower.x, tower.y, tower.def.glow, 60);
    this.particles.floatText(tower.x, tower.y - 30, `LEVEL ${tower.level}!`, '#fde68a');
    this.hooks.onHud(this.hud());
    this.hooks.onSelect(this.selectedTowerType, this.selectedTower);
    return true;
  }

  sellTower(tower) {
    const refund = Math.round(totalInvested(tower) * SELL_RATE);
    this.gold += refund;
    this.towers = this.towers.filter((candidate) => candidate !== tower);
    if (this.selectedTower === tower) this.selectedTower = null;
    this.sound.place();
    this.particles.floatText(tower.x, tower.y, `+${refund}g`, '#fde68a');
    this.hooks.onHud(this.hud());
    this.hooks.onSelect(this.selectedTowerType, this.selectedTower);
    return refund;
  }

  selectShop(type) {
    this.selectedTowerType = this.selectedTowerType === type ? null : type;
    this.selectedTower = null;
    this.hooks.onSelect(this.selectedTowerType, null);
  }

  selectPlaced(tower) {
    this.selectedTower = tower;
    this.selectedTowerType = null;
    this.hooks.onSelect(null, tower);
  }

  clearSelection() {
    this.selectedTowerType = null;
    this.selectedTower = null;
    this.hooks.onSelect(null, null);
  }

  // --- waves ------------------------------------------------------------

  startWave() {
    if (this.phase !== PHASE_BUILD) return false;
    if (this.wave >= MAX_WAVE) return false;
    const wave = this.waves[this.wave];
    this.waveTime = 0;
    this.spawnQueue = [];
    for (const group of wave.groups) {
      for (let index = 0; index < group.count; index += 1) {
        this.spawnQueue.push({ at: group.delay + index * group.gap, type: group.type });
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.phase = PHASE_WAVE;
    this.sound.waveStart();
    this.hooks.onPhase(this.phase);
    this.hooks.onToast(`Wave ${this.wave + 1} — hold the road!`);
    return true;
  }

  // --- per-frame update -------------------------------------------------

  update(dt) {
    if (this.paused) return;
    const scaled = dt * this.speed;
    this.time += scaled;
    this.sound.updateMusic(scaled, this.rng);
    this.particles.update(scaled);

    if (this.phase === PHASE_WAVE) {
      this.waveTime += scaled;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= this.waveTime) {
        const spawn = this.spawnQueue.shift();
        const wave = this.waves[this.wave];
        this.enemies.push(new Enemy(spawn.type, wave.hpMultiplier, this.pathPoints));
      }
      if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
        this.clearWave();
      }
    }

    // Towers fire.
    for (const tower of this.towers) {
      const projectile = tower.update(scaled, this.enemies, this.projectiles);
      if (projectile) this.sound.shoot(tower.type);
    }

    // Projectiles fly and land.
    for (const projectile of this.projectiles) {
      if (projectile.update(scaled, this.enemies) === 'hit') this.resolveHit(projectile);
    }
    this.projectiles = this.projectiles.filter((projectile) => !projectile.spent);

    // Enemies walk; leaks cost crystal.
    for (const enemy of this.enemies) {
      const result = enemy.update(scaled, this.time);
      if (result === 'leaked') {
        this.lives -= enemy.damage;
        this.leaks += 1;
        this.sound.leak();
        this.particles.burst(this.pathPoints[this.pathPoints.length - 1].x, this.pathPoints[this.pathPoints.length - 1].y, '#f43f5e', 16, 160);
        this.particles.floatText(this.pathPoints[this.pathPoints.length - 1].x - 20, this.pathPoints[this.pathPoints.length - 1].y - 30, `-${enemy.damage} ❤`, '#fda4af');
        if (this.lives <= 0) {
          this.lives = 0;
          this.endGame(false);
        }
      }
    }
    this.enemies = this.enemies.filter((enemy) => !enemy.dead && !enemy.leaked);

    if (this.phase === PHASE_WAVE && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.clearWave();
    }
    this.hooks.onHud(this.hud());
  }

  resolveHit(projectile) {
    const target = projectile.target;
    if (target.dead || target.leaked) return;
    const hitEnemies = [target];
    if (projectile.splash > 0) {
      for (const enemy of this.enemies) {
        if (enemy === target || enemy.dead || enemy.leaked) continue;
        if (Math.hypot(enemy.x - target.x, enemy.y - target.y) <= projectile.splash) hitEnemies.push(enemy);
      }
    }
    for (const enemy of hitEnemies) {
      enemy.takeDamage(projectile.damage, this.time);
      if (projectile.slowFactor !== null) enemy.applySlow(projectile.slowFactor, projectile.slowSeconds, this.time);
      if (enemy.dead) {
        this.kills += 1;
        this.gold += enemy.bounty;
        this.score += 10 + enemy.bounty;
        this.particles.burst(enemy.x, enemy.y, enemy.def.color, 10, 110);
        this.particles.floatText(enemy.x, enemy.y - 14, `+${enemy.bounty}g`, '#fde68a');
        if (projectile.tower) projectile.tower.kills += 1;
        this.sound.enemyDown();
      } else {
        this.sound.hit();
      }
    }
    this.particles.burst(target.x, target.y, projectile.tower.def.glow, 4, 90, 0.3, 2);
    if (projectile.splash > 0) this.particles.ring(target.x, target.y, projectile.tower.def.glow, projectile.splash);
  }

  clearWave() {
    this.wave += 1;
    const bonus = WAVE_CLEAR_BONUS(this.wave);
    this.gold += bonus;
    this.score += 50 * this.wave;
    this.sound.waveClear();
    if (this.wave >= MAX_WAVE) {
      this.endGame(true);
      return;
    }
    this.phase = PHASE_BUILD;
    this.hooks.onPhase(this.phase);
    this.hooks.onToast(`Wave ${this.wave} cleared! +${bonus}g bonus. Build, then start Wave ${this.wave + 1}.`);
    this.hooks.onHud(this.hud());
  }

  endGame(victory) {
    this.phase = PHASE_OVER;
    this.victory = victory;
    if (victory) {
      this.score += this.lives * 25;
      this.sound.victory();
    } else {
      this.sound.defeat();
    }
    this.sound.stopMusic();
    this.hooks.onPhase(this.phase);
    this.hooks.onHud(this.hud());
  }

  togglePause() {
    if (this.phase !== PHASE_BUILD && this.phase !== PHASE_WAVE) return;
    this.paused = !this.paused;
    this.hooks.onHud(this.hud());
  }

  toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
    this.hooks.onHud(this.hud());
  }

  // --- autopilot --------------------------------------------------------
  // Plays the game sensibly: build on the preferred cells, spend spare
  // gold on upgrades, start each wave as soon as it can. Used by the
  // screenshot scenes and by the headless balance check. Returns true
  // while it did anything this step.

  autopilotStep() {
    if (this.phase === PHASE_TITLE || this.phase === PHASE_OVER) return false;
    const order = ['spark', 'frost', 'cannon'];
    const buildNext = () => {
      const type = order[this.towers.length % order.length];
      if (this.gold < TOWER_TYPES[type].cost) return false;
      for (const [col, row] of PREFERRED_BUILD_CELLS) {
        if (this.canBuild(col, row)) {
          this.buildTower(type, col, row);
          return true;
        }
      }
      return false;
    };
    // Grow the defence first: new towers until ten stand, then the
    // cheapest upgrade, then more towers. Spends mid-wave too, as gold
    // comes in from kills.
    if (this.towers.length < 10) {
      if (buildNext()) return true;
    } else {
      const upgradeable = this.towers
        .filter((tower) => tower.upgradeCost !== null)
        .sort((a, b) => a.upgradeCost - b.upgradeCost);
      for (const tower of upgradeable) {
        if (this.gold >= tower.upgradeCost) {
          this.upgradeTower(tower);
          return true;
        }
      }
      if (buildNext()) return true;
    }
    if (this.phase === PHASE_BUILD) {
      this.startWave();
      return true;
    }
    return false;
  }

  // Run the game forward with the autopilot for up to `seconds` of game
  // time, in fixed steps. Returns the phase it stopped in.
  simulate(seconds, { autopilot = true } = {}) {
    const steps = Math.ceil(seconds / STEP);
    for (let index = 0; index < steps; index += 1) {
      if (autopilot) this.autopilotStep();
      this.update(STEP);
      if (this.phase === PHASE_OVER) break;
    }
    return this.phase;
  }
}
