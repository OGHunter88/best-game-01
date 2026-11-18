// Towers and their projectiles: what sits on a buildable cell, how it
// picks a target, and how its shots fly and land.

import { BOARD, MAX_TOWER_LEVEL, TOWER_TYPES, UPGRADE_DAMAGE, UPGRADE_LEVELS, UPGRADE_RANGE } from './config.js';

let nextTowerId = 1;
let nextProjectileId = 1;

export function towerCost(type, level = 1) {
  const base = TOWER_TYPES[type].cost;
  if (level <= 1) return base;
  return Math.round(base * UPGRADE_LEVELS[level]);
}

export function totalInvested(tower) {
  let sum = 0;
  for (let level = 1; level <= tower.level; level += 1) sum += towerCost(tower.type, level);
  return sum;
}

export class Tower {
  constructor(type, col, row) {
    const def = TOWER_TYPES[type];
    if (!def) throw new Error(`unknown tower type: ${type}`);
    this.id = nextTowerId;
    nextTowerId += 1;
    this.type = type;
    this.def = def;
    this.col = col;
    this.row = row;
    this.x = (col + 0.5) * BOARD.cell;
    this.y = (row + 0.5) * BOARD.cell;
    this.level = 1;
    this.cooldown = 0;
    this.angle = -Math.PI / 2; // barrel direction, for the drawing
    this.kills = 0;
    this.shotsFired = 0;
  }

  get range() {
    return this.def.range * UPGRADE_RANGE ** (this.level - 1);
  }

  get damage() {
    return this.def.damage * UPGRADE_DAMAGE ** (this.level - 1);
  }

  get rate() {
    return this.def.rate;
  }

  get upgradeCost() {
    if (this.level >= MAX_TOWER_LEVEL) return null;
    return towerCost(this.type, this.level + 1);
  }

  // Furthest along the road among enemies inside range.
  pickTarget(enemies) {
    let best = null;
    for (const enemy of enemies) {
      if (enemy.dead || enemy.leaked) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist > this.range + enemy.radius) continue;
      if (best === null || enemy.distanceWalked > best.distanceWalked) best = enemy;
    }
    return best;
  }

  // Returns a projectile to fire, or null while cooling down / no target.
  update(dt, enemies, projectiles) {
    this.cooldown -= dt;
    const target = this.pickTarget(enemies);
    if (target) this.angle = Math.atan2(target.y - this.y, target.x - this.x);
    if (!target || this.cooldown > 0) return null;
    this.cooldown = 1 / this.rate;
    this.shotsFired += 1;
    const projectile = new Projectile(this, target);
    projectiles.push(projectile);
    return projectile;
  }
}

export class Projectile {
  constructor(tower, target) {
    this.id = nextProjectileId;
    nextProjectileId += 1;
    this.tower = tower;
    this.target = target;
    this.type = tower.type;
    this.x = tower.x + Math.cos(tower.angle) * 20;
    this.y = tower.y + Math.sin(tower.angle) * 20;
    this.speed = tower.def.projectileSpeed;
    this.damage = tower.damage;
    this.splash = tower.def.splash ?? 0;
    this.slowFactor = tower.def.slowFactor ?? null;
    this.slowSeconds = tower.def.slowSeconds ?? 0;
    this.spent = false;
  }

  // Chase the target; on arrival apply the hit. Returns 'hit' when the
  // projectile lands (or its target is gone), else null.
  update(dt, enemies) {
    if (this.spent) return 'hit';
    if (this.target.dead || this.target.leaked) {
      this.spent = true;
      return 'hit';
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (dist <= step + this.target.radius * 0.5) {
      this.spent = true;
      return 'hit';
    }
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    return null;
  }
}
