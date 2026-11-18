// A tiny seeded random generator (mulberry32), so the screenshot scenes
// and the headless balance check always play the same game twice.

export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// A live-game RNG seeded from the clock; used everywhere the seeded one
// is not (real play is not meant to be reproducible).
export function liveRng() {
  return makeRng((Date.now() % 2147483647) + 1);
}
