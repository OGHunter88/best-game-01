// Enemies: what walks the road, how it moves, and what happens when it
// is hit, slowed, killed, or reaches the crystal.

import { ENEMY_TYPES } from './config.js';

let nextId = 1;

export class Enemy {
  constructor(type, hpMultiplier, pathPoints) {
    const def = ENEMY_TYPES[type];
    if (!def) throw new Error(`unknown enemy type: ${type}`);
    this.id = nextId;
    nextId += 1;
    this.type = type;
    this.def = def;
    this.maxHp = Math.round(def.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.speed = def.speed;
    this.bounty = def.bounty;
    this.damage = def.damage;
    this.radius = def.radius;
    this.path = pathPoints;
    this.waypoint = 1; // next waypoint index; starts just off the west edge
    this.x = pathPoints[0].x;
    this.y = pathPoints[0].y;
    this.distanceWalked = 0; // how far along the road: towers aim furthest
    this.slowUntil = 0; // game clock time until which it is slowed
    this.slowFactor = 1;
    this.dead = false;
    this.leaked = false;
    this.wobble = Math.random() * Math.PI * 2; // per-enemy walk sway
    this.flash = 0; // seconds of white hit-flash left
  }

  get slowed() {
    return this.slowFactor < 1;
  }

  takeDamage(amount, now) {
    if (this.dead) return 0;
    this.hp -= amount;
    this.flash = 0.08;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    return amount;
  }

  applySlow(factor, seconds, now) {
    // A stronger (smaller) slow wins; re-applying refreshes the timer.
    if (factor < this.slowFactor || now >= this.slowUntil) {
      this.slowFactor = factor;
    }
    this.slowUntil = Math.max(this.slowUntil, now + seconds);
  }

  // Advance along the road for dt seconds. Returns 'leaked' when it
  // reaches the crystal, 'dead' when it was already dead, else null.
  update(dt, now) {
    if (this.dead) return 'dead';
    if (this.flash > 0) this.flash -= dt;
    const slowed = now < this.slowUntil;
    const factor = slowed ? this.slowFactor : 1;
    if (!slowed) this.slowFactor = 1;
    let remaining = this.speed * factor * dt;
    while (remaining > 0) {
      const target = this.path[this.waypoint];
      if (!target) {
        this.leaked = true;
        return 'leaked';
      }
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= remaining) {
        this.x = target.x;
        this.y = target.y;
        this.distanceWalked += dist;
        remaining -= dist;
        this.waypoint += 1;
      } else {
        this.x += (dx / dist) * remaining;
        this.y += (dy / dist) * remaining;
        this.distanceWalked += remaining;
        remaining = 0;
      }
    }
    return null;
  }
}
