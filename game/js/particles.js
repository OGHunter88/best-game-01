// Particles and floating text: the sparks, bursts and damage numbers
// that make every hit feel like something happened. Pure visual state;
// the game never reads it back.

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.texts = [];
  }

  burst(x, y, color, count, speed = 120, life = 0.5, size = 3) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
      });
    }
  }

  ring(x, y, color, maxRadius = 46) {
    this.particles.push({
      x, y, vx: 0, vy: 0,
      life: 0.35, maxLife: 0.35, size: 2,
      color, ring: true, ringRadius: maxRadius,
    });
  }

  floatText(x, y, text, color = '#fef3c7') {
    this.texts.push({ x, y, text, life: 0.9, maxLife: 0.9, color });
  }

  update(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const text of this.texts) {
      text.life -= dt;
      text.y -= 28 * dt;
    }
    this.texts = this.texts.filter((text) => text.life > 0);
  }

  clear() {
    this.particles = [];
    this.texts = [];
  }
}
