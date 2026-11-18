// SOLMARA — Streets of the Sun: shared tuning and world constants.
// Every number below is original to this build: a sun-soaked fictional city
// called Solmara, 3600 by 3600 units, laid out on an 8 by 8 road grid.

export const WORLD_SIZE = 3600;
export const GRID_COUNT = 8;
export const GRID_PITCH = 450;
export const ROAD_WIDTH = 110;
export const HALF_ROAD = ROAD_WIDTH / 2;

// Road centrelines: the first road sits 225 units in from the edge, then one
// every 450 units, so blocks are 340 units of buildable land between roads.
export const ROAD_CENTERS = [225, 675, 1125, 1575, 2025, 2475, 2925, 3375];

export const GARAGE = { x: 225, y: 225, r: 130, name: "Rosa's Garage" };
export const BANK = { x: 2025, y: 1125, r: 110, name: 'Solmara First Bank' };
export const HOTEL = { x: 1575, y: 675, r: 110, name: 'Hotel Miramonte' };
export const PARK = { gx: 3, gy: 3, x: 1575, y: 1575, r: 210, name: 'Palmera Park' };
export const DOCKS_X = 3205;
export const BEACH_Y = 3150;

export const SAVE_KEY = 'solmara-save-v1';
export const GAME_TITLE = 'SOLMARA — Streets of the Sun';

// Sun-soaked palette: warm asphalt, sand, terracotta roofs, turquoise sea.
export const COLORS = {
  grass: '#7fb069',
  grassDark: '#6da25c',
  park: '#4e9b47',
  parkTree: '#2f7d32',
  sand: '#eed9a4',
  sea: '#2fa8c9',
  seaDeep: '#1e7fa8',
  asphalt: '#3d3a38',
  asphaltLight: '#4a4642',
  lane: '#f5d76e',
  sidewalk: '#b8a88f',
  curb: '#8f8071',
  roofA: '#c96f4a',
  roofB: '#d9a441',
  roofC: '#7d9db5',
  roofD: '#b5533c',
  roofE: '#e0b48f',
  wallA: '#f2e3c6',
  wallB: '#e8cfa8',
  wallC: '#d8b48f',
  hud: '#101418',
  hudText: '#fff3d6',
  accent: '#ffb703',
  danger: '#ff4757',
  police: '#1e5fd6',
  gold: '#ffd166',
};

export const TUNING = {
  walkSpeed: 195,
  runSpeed: 305,
  playerRadius: 15,
  playerHealth: 100,
  carAccel: 620,
  carBrake: 900,
  carReverse: 260,
  carMaxSpeed: 560,
  carTurn: 2.6,
  carGrip: 0.92,
  trafficSpeed: 150,
  trafficMax: 14,
  pedMax: 26,
  pedSpeed: 55,
  copMaxSpeed: 590,
  copAccel: 700,
  bulletSpeed: 900,
  bulletLife: 0.7,
  punchRange: 46,
  punchDamage: 34,
  gunDamage: 34,
  wantedDecaySeconds: 9,
  bustedCatchRadius: 30,
  bustedCatchTime: 1.1,
  cameraZoom: 1.0,
  minimapSize: 168,
};

// Small math helpers shared by every module.
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle `a` toward angle `b`.
export function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDelta(a, b) * clamp(t, 0, 1);
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function circleHitsRect(cx, cy, cr, r) {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}
