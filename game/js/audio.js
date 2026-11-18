// All sound is synthesised with WebAudio — no audio files, no network.
// Every method is a no-op until the player has interacted (browsers block
// audio before a gesture) and when there is no window at all (the headless
// balance check runs this module under Node).

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.musicNodes = null;
    this.musicStep = 0;
    this.musicTimer = 0;
  }

  // Call from the first click / keypress. Safe to call repeatedly.
  unlock() {
    if (typeof window === 'undefined') return;
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // One short oscillator blip with an exponential fade.
  blip({ frequency = 440, endFrequency = null, duration = 0.12, type = 'sine', volume = 0.2, delay = 0 }) {
    if (!this.context || this.muted) return;
    try {
      const start = this.context.currentTime + delay;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      if (endFrequency !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // Sound is garnish; a failed blip never breaks the game.
    }
  }

  shoot(kind) {
    if (kind === 'cannon') this.blip({ frequency: 160, endFrequency: 60, duration: 0.18, type: 'triangle', volume: 0.22 });
    else if (kind === 'frost') this.blip({ frequency: 880, endFrequency: 1320, duration: 0.09, type: 'sine', volume: 0.1 });
    else this.blip({ frequency: 720, endFrequency: 980, duration: 0.07, type: 'square', volume: 0.07 });
  }

  hit() {
    this.blip({ frequency: 300, endFrequency: 180, duration: 0.05, type: 'sine', volume: 0.08 });
  }

  enemyDown() {
    this.blip({ frequency: 520, endFrequency: 90, duration: 0.16, type: 'sawtooth', volume: 0.12 });
  }

  leak() {
    this.blip({ frequency: 220, endFrequency: 55, duration: 0.35, type: 'sawtooth', volume: 0.2 });
    this.blip({ frequency: 110, endFrequency: 40, duration: 0.4, type: 'triangle', volume: 0.18, delay: 0.05 });
  }

  place() {
    this.blip({ frequency: 330, endFrequency: 495, duration: 0.1, type: 'triangle', volume: 0.16 });
    this.blip({ frequency: 660, duration: 0.08, type: 'sine', volume: 0.1, delay: 0.06 });
  }

  upgrade() {
    [523, 659, 784].forEach((frequency, index) => {
      this.blip({ frequency, duration: 0.12, type: 'triangle', volume: 0.14, delay: index * 0.07 });
    });
  }

  denied() {
    this.blip({ frequency: 180, endFrequency: 120, duration: 0.12, type: 'square', volume: 0.1 });
  }

  waveStart() {
    this.blip({ frequency: 196, duration: 0.14, type: 'triangle', volume: 0.18 });
    this.blip({ frequency: 294, duration: 0.18, type: 'triangle', volume: 0.18, delay: 0.12 });
  }

  waveClear() {
    [392, 523, 659].forEach((frequency, index) => {
      this.blip({ frequency, duration: 0.16, type: 'triangle', volume: 0.14, delay: index * 0.09 });
    });
  }

  victory() {
    [523, 659, 784, 1047].forEach((frequency, index) => {
      this.blip({ frequency, duration: 0.3, type: 'triangle', volume: 0.16, delay: index * 0.13 });
    });
  }

  defeat() {
    [392, 330, 262, 196].forEach((frequency, index) => {
      this.blip({ frequency, duration: 0.35, type: 'sawtooth', volume: 0.12, delay: index * 0.16 });
    });
  }

  // A quiet two-note drone plus a slow pentatonic wander, advanced by the
  // game loop. Started once, on the first wave; stopped on mute/off.
  startMusic() {
    if (!this.context || this.musicNodes) return;
    try {
      const pad = this.context.createGain();
      pad.gain.value = 0.035;
      pad.connect(this.master);
      const low = this.context.createOscillator();
      low.type = 'sine';
      low.frequency.value = 110;
      const high = this.context.createOscillator();
      high.type = 'sine';
      high.frequency.value = 164.81;
      low.connect(pad);
      high.connect(pad);
      low.start();
      high.start();
      this.musicNodes = { pad, low, high };
    } catch {
      this.musicNodes = null;
    }
  }

  stopMusic() {
    if (!this.musicNodes) return;
    try {
      this.musicNodes.low.stop();
      this.musicNodes.high.stop();
      this.musicNodes.pad.disconnect();
    } catch {
      // Already stopped.
    }
    this.musicNodes = null;
  }

  // Called every frame with dt; every ~0.9 s it may pluck a soft note.
  updateMusic(dt, rng) {
    if (!this.context || this.muted || !this.musicNodes) return;
    this.musicTimer += dt;
    if (this.musicTimer < 0.9) return;
    this.musicTimer = 0;
    if (rng() < 0.45) return;
    const scale = [220, 261.63, 293.66, 329.63, 392, 440];
    const note = scale[Math.floor(rng() * scale.length)];
    this.blip({ frequency: note, duration: 0.9, type: 'sine', volume: 0.05 });
  }
}
