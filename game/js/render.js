// Rendering: everything drawn on the board canvas — the night field,
// the ember road, the crystal, towers, enemies, projectiles and effects.
// Reads game state, never changes it.

import { BOARD, CRYSTAL_CELL, TOWER_TYPES } from './config.js';

const PALETTE = {
  fieldA: '#101736',
  fieldB: '#0d1330',
  path: '#241a12',
  pathEdge: '#f59e0b',
  grid: 'rgba(148, 163, 184, 0.07)',
  crystal: '#22d3ee',
  crystalCore: '#ecfeff',
  ghostOk: 'rgba(74, 222, 128, 0.45)',
  ghostBad: 'rgba(244, 63, 94, 0.45)',
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
  }

  resizeForDpr() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const width = BOARD.width;
    const height = BOARD.height;
    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(game, dt) {
    this.time += dt;
    this.resizeForDpr();
    const ctx = this.ctx;
    this.drawField(ctx, game);
    this.drawRoad(ctx, game);
    this.drawCrystal(ctx, game);
    this.drawPlacement(ctx, game);
    for (const tower of game.towers) this.drawTower(ctx, tower);
    for (const enemy of game.enemies) this.drawEnemy(ctx, enemy);
    for (const projectile of game.projectiles) this.drawProjectile(ctx, projectile);
    this.drawParticles(ctx, game);
    this.drawTexts(ctx, game);
  }

  drawField(ctx, game) {
    for (let row = 0; row < BOARD.rows; row += 1) {
      for (let col = 0; col < BOARD.cols; col += 1) {
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.fieldA : PALETTE.fieldB;
        ctx.fillRect(col * BOARD.cell, row * BOARD.cell, BOARD.cell, BOARD.cell);
      }
    }
    // Faint stars scattered over the field.
    ctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
    for (let index = 0; index < 40; index += 1) {
      const x = ((index * 197) % BOARD.width) + 8;
      const y = ((index * 131) % BOARD.height) + 8;
      ctx.fillRect(x, y, 2, 2);
    }
    void game;
  }

  drawRoad(ctx, game) {
    const points = game.pathPoints;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Glow under the road.
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.lineWidth = BOARD.cell * 0.94;
    this.tracePath(ctx, points);
    ctx.stroke();
    // The road itself.
    ctx.strokeStyle = PALETTE.path;
    ctx.lineWidth = BOARD.cell * 0.8;
    this.tracePath(ctx, points);
    ctx.stroke();
    // Ember dashes running along its centre.
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 26]);
    ctx.lineDashOffset = -this.time * 24;
    this.tracePath(ctx, points);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  tracePath(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  }

  drawCrystal(ctx, game) {
    const x = (CRYSTAL_CELL.col + 0.5) * BOARD.cell;
    const y = (CRYSTAL_CELL.row + 0.5) * BOARD.cell;
    const pulse = 1 + Math.sin(this.time * 2.2) * 0.06;
    const radius = 26 * pulse;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, radius * 2.4);
    glow.addColorStop(0, 'rgba(34, 211, 238, 0.5)');
    glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.4, 0, Math.PI * 2);
    ctx.fill();
    // A diamond crystal.
    ctx.fillStyle = PALETTE.crystal;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius * 0.72, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius * 0.72, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.crystalCore;
    ctx.beginPath();
    ctx.moveTo(x, y - radius * 0.55);
    ctx.lineTo(x + radius * 0.36, y);
    ctx.lineTo(x, y + radius * 0.55);
    ctx.lineTo(x - radius * 0.36, y);
    ctx.closePath();
    ctx.fill();
    // Crystal health as a small bar underneath.
    const width = 52;
    const ratio = Math.max(0, game.lives / 20);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.fillRect(x - width / 2, y + radius + 8, width, 6);
    ctx.fillStyle = ratio > 0.5 ? '#34d399' : ratio > 0.25 ? '#fbbf24' : '#f43f5e';
    ctx.fillRect(x - width / 2, y + radius + 8, width * ratio, 6);
  }

  drawPlacement(ctx, game) {
    // Range ring for the selected tower (placed or shop ghost).
    let range = null;
    let cx = 0;
    let cy = 0;
    if (game.selectedTower) {
      range = game.selectedTower.range;
      cx = game.selectedTower.x;
      cy = game.selectedTower.y;
    } else if (game.selectedTowerType && game.hoverCell) {
      range = TOWER_TYPES[game.selectedTowerType].range;
      cx = (game.hoverCell.col + 0.5) * BOARD.cell;
      cy = (game.hoverCell.row + 0.5) * BOARD.cell;
    }
    if (range !== null) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.beginPath();
      ctx.arc(cx, cy, range, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, range, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Ghost of the tower that would be placed under the mouse.
    if (game.selectedTowerType && game.hoverCell) {
      const { col, row } = game.hoverCell;
      const ok = game.canBuild(col, row) && game.gold >= TOWER_TYPES[game.selectedTowerType].cost;
      ctx.fillStyle = ok ? PALETTE.ghostOk : PALETTE.ghostBad;
      ctx.fillRect(col * BOARD.cell + 4, row * BOARD.cell + 4, BOARD.cell - 8, BOARD.cell - 8);
      if (ok) {
        const savedAlpha = ctx.globalAlpha;
        ctx.globalAlpha = 0.7;
        this.drawTowerShape(ctx, game.selectedTowerType, (col + 0.5) * BOARD.cell, (row + 0.5) * BOARD.cell, -Math.PI / 2, 1);
        ctx.globalAlpha = savedAlpha;
      }
    }
  }

  drawTower(ctx, tower) {
    // Stone base.
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    const size = 46;
    ctx.beginPath();
    ctx.roundRect(tower.x - size / 2, tower.y - size / 2, size, size, 9);
    ctx.fill();
    ctx.stroke();
    this.drawTowerShape(ctx, tower.type, tower.x, tower.y, tower.angle, tower.level);
    // Level pips.
    for (let index = 0; index < tower.level; index += 1) {
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(tower.x - 12 + index * 12, tower.y + 28, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTowerShape(ctx, type, x, y, angle, level) {
    const def = TOWER_TYPES[type];
    const scale = 1 + (level - 1) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(angle);
    if (type === 'spark') {
      // A pronged spire: barrel + coil rings.
      ctx.fillStyle = def.color;
      ctx.fillRect(0, -4, 24, 8);
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = def.glow;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'frost') {
      // A six-pointed snowflake crystal.
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      for (let index = 0; index < 3; index += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-13, 0);
        ctx.lineTo(13, 0);
        ctx.stroke();
      }
      ctx.fillStyle = def.glow;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // A stubby cannon: barrel + breech.
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = def.color;
      ctx.fillRect(0, -6, 26, 12);
      ctx.fillStyle = def.glow;
      ctx.beginPath();
      ctx.arc(24, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEnemy(ctx, enemy) {
    const wobble = Math.sin(this.time * 6 + enemy.wobble) * 2;
    const x = enemy.x;
    const y = enemy.y + wobble;
    // Shadow blob.
    ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, enemy.y + enemy.radius * 0.8, enemy.radius, enemy.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    const glow = ctx.createRadialGradient(x, y, 2, x, y, enemy.radius);
    glow.addColorStop(0, enemy.def.color);
    glow.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : glow;
    ctx.beginPath();
    ctx.arc(x, y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    // Eyes (two glowing dots, looking along the road).
    const ahead = enemy.waypoint < enemy.path.length
      ? Math.atan2(enemy.path[enemy.waypoint].y - enemy.y, enemy.path[enemy.waypoint].x - enemy.x)
      : 0;
    const eyeDx = Math.cos(ahead);
    const eyeDy = Math.sin(ahead);
    const perpX = -eyeDy;
    const perpY = eyeDx;
    ctx.fillStyle = enemy.def.eye;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + eyeDx * 4 + perpX * side * 5, y + eyeDy * 4 + perpY * side * 5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Slow tint.
    if (enemy.slowed) {
      ctx.fillStyle = 'rgba(125, 211, 252, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Health bar, only when hurt.
    if (enemy.hp < enemy.maxHp) {
      const width = enemy.radius * 2;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
      ctx.fillRect(x - width / 2, y - enemy.radius - 10, width, 5);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(x - width / 2, y - enemy.radius - 10, width * (enemy.hp / enemy.maxHp), 5);
    }
  }

  drawProjectile(ctx, projectile) {
    const color = TOWER_TYPES[projectile.type].glow;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.type === 'cannon' ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawParticles(ctx, game) {
    for (const particle of game.particles.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.ring) {
        const progress = 1 - alpha;
        ctx.strokeStyle = particle.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.ringRadius * progress + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawTexts(ctx, game) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px system-ui, sans-serif';
    for (const text of game.particles.texts) {
      const alpha = Math.max(0, text.life / text.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
      ctx.globalAlpha = 1;
    }
  }
}
