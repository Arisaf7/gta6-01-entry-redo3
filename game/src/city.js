// SOLMARA: the city of Solmara — layout, buildings, roads and zones.
// The city is data built once from a seed: an 8x8 grid of roads, blocks of
// buildings between them, a park, a beach along the south edge, docks on the
// east edge, and three landmarks (garage, bank, hotel). Nothing here is
// copied from any real place: the street names and districts are invented.

import {
  WORLD_SIZE, GRID_COUNT, GRID_PITCH, ROAD_WIDTH, ROAD_CENTERS,
  GARAGE, BANK, HOTEL, PARK, DOCKS_X, BEACH_Y, COLORS,
} from './config.js';
import { Rng } from './random.js';

const ROOF_COLORS = [COLORS.roofA, COLORS.roofB, COLORS.roofC, COLORS.roofD, COLORS.roofE];
const WALL_COLORS = [COLORS.wallA, COLORS.wallB, COLORS.wallC];
const STREET_NAMES = [
  'Palmera Ave', 'Solano Blvd', 'Marina Row', 'Cactus St', 'Luz Lane',
  'Coral Way', 'Fiesta St', 'Alegria Ave', 'Brisa Blvd', 'Toro St',
];

export function buildCity(seed) {
  const rng = new Rng(seed);
  const buildings = [];
  const halfBlock = (GRID_PITCH - ROAD_WIDTH) / 2;

  // One building cluster per block. Blocks sit BETWEEN roads: with 8 roads
  // there are 7 inter-road blocks per axis, centred 225 past each road.
  // Skipped: the park block, the garage block, and anything that would
  // spill onto the beach (south edge) or the docks (east edge).
  for (let gx = 0; gx < GRID_COUNT - 1; gx += 1) {
    for (let gy = 0; gy < GRID_COUNT - 1; gy += 1) {
      if (gx === PARK.gx && gy === PARK.gy) continue;
      if (gx === 0 && gy === 0) continue;
      const cx = ROAD_CENTERS[gx] + GRID_PITCH / 2;
      const cy = ROAD_CENTERS[gy] + GRID_PITCH / 2;
      const count = rng.int(2, 4);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(70, 150);
        const h = rng.range(70, 150);
        const x = cx - halfBlock + rng.range(12, halfBlock * 2 - w - 12);
        const y = cy - halfBlock + rng.range(12, halfBlock * 2 - h - 12);
        if (y + h > BEACH_Y - 20) continue;
        if (x + w > DOCKS_X - 20) continue;
        if (Math.hypot(x + w / 2 - PARK.x, y + h / 2 - PARK.y) < PARK.r + 50) continue;
        buildings.push({
          x, y, w, h,
          roof: rng.pick(ROOF_COLORS),
          wall: rng.pick(WALL_COLORS),
          tall: rng.chance(0.22),
          label: rng.pick(STREET_NAMES),
        });
      }
    }
  }

  // Landmark buildings sit on their own plots and are drawn distinctly.
  buildings.push({
    x: GARAGE.x - 95, y: GARAGE.y - 60, w: 190, h: 120,
    roof: COLORS.roofD, wall: COLORS.wallB, tall: false, landmark: 'garage',
  });
  buildings.push({
    x: BANK.x - 80, y: BANK.y - 95, w: 160, h: 110,
    roof: COLORS.roofC, wall: COLORS.wallA, tall: true, landmark: 'bank',
  });
  buildings.push({
    x: HOTEL.x - 70, y: HOTEL.y - 90, w: 150, h: 130,
    roof: COLORS.roofB, wall: COLORS.wallA, tall: true, landmark: 'hotel',
  });

  return {
    seed,
    buildings,
    roads: ROAD_CENTERS,
    park: { x: PARK.x, y: PARK.y, r: PARK.r },
    beach: { x: 0, y: BEACH_Y, w: WORLD_SIZE, h: WORLD_SIZE - BEACH_Y },
    sea: { x: 0, y: WORLD_SIZE - 130, w: WORLD_SIZE, h: 130 },
    docks: { x: DOCKS_X, y: 0, w: WORLD_SIZE - DOCKS_X, h: BEACH_Y },
    garage: GARAGE,
    bank: BANK,
    hotel: HOTEL,
  };
}

// True when a point lies on a road (within half the road width of a
// centreline on either axis).
export function isRoad(x, y) {
  const half = ROAD_WIDTH / 2 + 6;
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) <= half || Math.abs(y - c) <= half) return true;
  }
  return false;
}

// True when a circle of radius r at (x, y) overlaps any building or leaves
// the world. Used for on-foot and driving collision.
export function isBlocked(city, x, y, r) {
  if (x < r || y < r || x > WORLD_SIZE - r || y > WORLD_SIZE - r) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
      return true;
    }
  }
  return false;
}

// Slide a circle along buildings: try the full step, then each axis alone.
export function moveWithCollision(city, x, y, dx, dy, r) {
  if (!isBlocked(city, x + dx, y + dy, r)) return { x: x + dx, y: y + dy, hit: false };
  if (!isBlocked(city, x + dx, y, r)) return { x: x + dx, y, hit: true };
  if (!isBlocked(city, x, y + dy, r)) return { x, y: y + dy, hit: true };
  return { x, y, hit: true };
}

// Nearest road centreline coordinate to a value on one axis.
export function nearestRoadCenter(v) {
  let best = ROAD_CENTERS[0];
  for (const c of ROAD_CENTERS) {
    if (Math.abs(v - c) < Math.abs(v - best)) best = c;
  }
  return best;
}

// A random point on a road, for spawning traffic and pedestrians.
export function randomRoadPoint(rng) {
  const horizontal = rng.chance(0.5);
  const c = rng.pick(ROAD_CENTERS);
  const along = rng.range(120, WORLD_SIZE - 120);
  return horizontal ? { x: along, y: c } : { x: c, y: along };
}

export { GRID_COUNT, GRID_PITCH, ROAD_WIDTH, ROAD_CENTERS };
