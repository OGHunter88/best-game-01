// Emberfall Keep — tuning constants and entity definitions.
//
// One job: every number the game balances on lives here, so tuning never
// means hunting through logic. Towers, enemies and waves are plain data;
// game.js, towers.js and enemies.js only read them.

export const BOARD = {
  cols: 16,
  rows: 10,
  cell: 64,
  width: 1024, // cols * cell
  height: 640, // rows * cell
};

// The road the creatures walk, in cell coordinates (waypoint centres).
// Serpentine: in at row 1, down col 13, back along row 4, down col 2,
// out along row 7, down to row 8, then east into the crystal at (15, 8).
export const PATH_WAYPOINTS = [
  [-1, 1],
  [13, 1],
  [13, 4],
  [2, 4],
  [2, 7],
  [13, 7],
  [13, 8],
  [15, 8],
];

export const CRYSTAL_CELL = { col: 15, row: 8 };

export const START_GOLD = 200;
export const START_LIVES = 20;
export const MAX_WAVE = 12;
export const SELL_RATE = 0.7;
export const WAVE_CLEAR_BONUS = (wave) => 25 + 5 * wave;

// Health multiplier applied to every enemy of a wave (wave 1 = 1.00).
export const waveHpMultiplier = (wave) => 1 + 0.5 * (wave - 1);

// A tower type: what it costs, how far it reaches, how fast it shoots,
// how hard each shot hits, and what makes it different.
export const TOWER_TYPES = {
  spark: {
    name: 'Spark Spire',
    short: 'Spark',
    cost: 50,
    range: 150,
    rate: 2.2, // shots per second
    damage: 8,
    projectileSpeed: 460,
    color: '#ffd166',
    glow: '#ff9f1c',
    blurb: 'Fast bolts. Cheap, reliable, and everywhere at once.',
  },
  frost: {
    name: 'Frost Obelisk',
    short: 'Frost',
    cost: 75,
    range: 145,
    rate: 1.1,
    damage: 4,
    slowFactor: 0.55, // enemy speed * this while slowed
    slowSeconds: 1.6,
    projectileSpeed: 380,
    color: '#7dd3fc',
    glow: '#38bdf8',
    blurb: 'Chills the horde to a crawl. Little damage, big control.',
  },
  cannon: {
    name: 'Ember Cannon',
    short: 'Cannon',
    cost: 120,
    range: 175,
    rate: 0.7,
    damage: 28,
    splash: 60, // radius in px around the hit
    projectileSpeed: 300,
    color: '#fb7185',
    glow: '#f43f5e',
    blurb: 'Slow, heavy shells that burst and hurt the whole pack.',
  },
};

// Upgrading a tower: each level costs a share of the base price and
// multiplies damage (and a little range). Level 1 is the base tower.
export const UPGRADE_LEVELS = [null, null, 0.75, 1.25]; // index = target level
export const UPGRADE_DAMAGE = 1.32; // per level, compounded
export const UPGRADE_RANGE = 1.08; // per level, compounded
export const MAX_TOWER_LEVEL = 3;

// An enemy type: how tough, how fast, what it pays when it dies and
// how much crystal it eats when it gets through.
export const ENEMY_TYPES = {
  wisp: {
    name: 'Wisp',
    hp: 30,
    speed: 62,
    bounty: 6,
    damage: 1,
    radius: 13,
    color: '#c084fc',
    eye: '#f5d0fe',
    blurb: 'Drifts in, dozens at a time.',
  },
  skitter: {
    name: 'Skitter',
    hp: 16,
    speed: 110,
    bounty: 5,
    damage: 1,
    radius: 10,
    color: '#f472b6',
    eye: '#fbcfe8',
    blurb: 'Small, fast, and hard to pin down.',
  },
  husk: {
    name: 'Husk',
    hp: 130,
    speed: 36,
    bounty: 10,
    damage: 2,
    radius: 17,
    color: '#a8a29e',
    eye: '#fbbf24',
    blurb: 'A slow shell that soaks up fire.',
  },
  wraith: {
    name: 'Wraith',
    hp: 75,
    speed: 55,
    bounty: 9,
    damage: 1,
    radius: 14,
    color: '#818cf8',
    eye: '#e0e7ff',
    blurb: 'Half here, half somewhere else.',
  },
  brute: {
    name: 'Brute',
    hp: 380,
    speed: 28,
    bounty: 40,
    damage: 3,
    radius: 21,
    color: '#fb923c',
    eye: '#fff7ed',
    blurb: 'A battering ram with legs.',
  },
  golem: {
    name: 'Ash Golem',
    hp: 1500,
    speed: 22,
    bounty: 150,
    damage: 10,
    radius: 27,
    color: '#e11d48',
    eye: '#fecdd3',
    blurb: 'The mountain that walks. Stop it, and the Keep stands.',
  },
};
