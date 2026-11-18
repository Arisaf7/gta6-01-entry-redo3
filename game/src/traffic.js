// SOLMARA: traffic cars and pedestrians.
// Two fleets with different lifetimes — this split is load-bearing:
//   - parkedCars are laid out ONCE when the world is built and are never
//     re-rolled. A mission restart must not reshuffle the street.
//   - moving cars and pedestrians are dynamic and are respawned on reset.
// Traffic cars follow road centrelines, slow for the car ahead, and turn at
// intersections. Pedestrians stroll the sidewalks and flee from violence.

import { WORLD_SIZE, ROAD_CENTERS, TUNING } from './config.js';
import { Rng } from './random.js';
import { isBlocked, moveWithCollision, randomRoadPoint } from './city.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b93c', '#7bc950', '#e8e4da', '#8e6fc0', '#2f2a26', '#d97ba8'];
const CAR_MODELS = ['sedan', 'hatch', 'taxi', 'van', 'pickup', 'sport'];
const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1'];
const PED_SHIRTS = ['#ff6b6b', '#48dbfb', '#feca57', '#1dd1a1', '#a29bfe', '#ff9f43', '#c8d64f'];

function makeCar(rng, x, y, angle, parked) {
  return {
    x, y, angle,
    speed: 0,
    baseSpeed: TUNING.trafficSpeed * rng.range(0.75, 1.25),
    color: rng.pick(CAR_COLORS),
    model: rng.pick(CAR_MODELS),
    parked,
    // Lane driving: axis 'h' | 'v', lane offset and direction along it.
    axis: Math.abs(angle) < 0.01 || Math.abs(Math.abs(angle) - Math.PI) < 0.01 ? 'h' : 'v',
    lane: rng.chance(0.5) ? -26 : 26,
    dir: rng.chance(0.5) ? 1 : -1,
    health: 100,
    stuck: 0,
  };
}

export class Traffic {
  constructor(city, seed) {
    this.city = city;
    this.rng = new Rng(seed + 101);
    this.cars = [];
    this.peds = [];
    this.parkedCars = this._layOutParkedCars();
    this.resetDynamic();
  }

  // Parked cars: fixed for the life of this world. Called once only.
  // They sit in the outer lane of a road (40 off the centreline, inside
  // the 55 half-width), never inside a building: a spot that collides
  // with a building is dropped, so every parked car can be driven away.
  _layOutParkedCars() {
    const rng = new Rng(4242);
    const parked = [];
    const spots = [];
    for (const c of ROAD_CENTERS) {
      for (let k = 0; k < 5; k += 1) {
        spots.push({ x: c + 40, y: 320 + k * 620, angle: Math.PI / 2 });
        spots.push({ x: c - 40, y: 480 + k * 620, angle: -Math.PI / 2 });
      }
    }
    for (const s of rng.shuffle(spots).slice(0, 22)) {
      if (s.y > 3100) continue;
      if (isBlocked(this.city, s.x, s.y, 26)) continue;
      parked.push(makeCar(rng, s.x, s.y, s.angle, true));
    }
    return parked;
  }

  resetDynamic() {
    const rng = this.rng;
    this.cars = [];
    for (let i = 0; i < TUNING.trafficMax; i += 1) {
      const p = randomRoadPoint(rng);
      const angle = rng.chance(0.5) ? 0 : Math.PI / 2;
      const car = makeCar(rng, p.x, p.y, angle, false);
      car.speed = car.baseSpeed;
      this.cars.push(car);
    }
    this.peds = [];
    for (let i = 0; i < TUNING.pedMax; i += 1) {
      const p = randomRoadPoint(rng);
      this.peds.push({
        x: p.x + rng.range(-70, 70),
        y: p.y + rng.range(-70, 70),
        angle: rng.range(0, Math.PI * 2),
        speed: TUNING.pedSpeed * rng.range(0.7, 1.3),
        shirt: rng.pick(PED_SHIRTS),
        skin: rng.pick(PED_COLORS),
        state: 'walk',
        fleeT: 0,
        panic: 0,
      });
    }
  }

  allCars() {
    return this.parkedCars.concat(this.cars);
  }

  nearestCar(x, y, maxDist, includeParked = true) {
    let best = null;
    let bestD = maxDist;
    const list = includeParked ? this.allCars() : this.cars;
    for (const car of list) {
      const dx = car.x - x;
      const dy = car.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  nearestPed(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of this.peds) {
      const d = Math.hypot(ped.x - x, ped.y - y);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  // Pedestrians near a scare point start fleeing.
  scare(x, y, radius) {
    for (const ped of this.peds) {
      if (Math.hypot(ped.x - x, ped.y - y) < radius) {
        ped.state = 'flee';
        ped.fleeT = 2.5;
        ped.angle = Math.atan2(ped.y - y, ped.x - x);
      }
    }
  }

  update(dt, world) {
    const player = world.player;
    for (const car of this.cars) {
      if (car.health <= 0) continue;
      // The player's own car is driven by the player, never by traffic:
      // letting both systems move it made it fight the driver's steering.
      if (player && player.car === car) continue;
      // Lane target: stay on the centreline plus the lane offset.
      let tx;
      let ty;
      if (car.axis === 'h') {
        ty = nearestRoadY(car.y) + car.lane;
        tx = car.x + car.dir * car.baseSpeed * dt;
      } else {
        tx = nearestRoadX(car.x) + car.lane;
        ty = car.y + car.dir * car.baseSpeed * dt;
      }
      // Slow down for a car ahead on the same lane.
      let want = car.baseSpeed;
      for (const other of this.cars) {
        if (other === car || other.health <= 0) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = car.axis === 'h'
          ? Math.sign(dx) === car.dir && Math.abs(dy) < 40 && Math.abs(dx) < 90
          : Math.sign(dy) === car.dir && Math.abs(dx) < 40 && Math.abs(dy) < 90;
        if (ahead) want = Math.min(want, 40);
      }
      // The player's car ahead also makes traffic brake.
      if (player && !player.onFoot && player.car) {
        const dx = player.car.x - car.x;
        const dy = player.car.y - car.y;
        const ahead = car.axis === 'h'
          ? Math.sign(dx) === car.dir && Math.abs(dy) < 40 && Math.abs(dx) < 110
          : Math.sign(dy) === car.dir && Math.abs(dx) < 40 && Math.abs(dy) < 110;
        if (ahead) want = Math.min(want, 30);
      }
      car.speed += (want - car.speed) * Math.min(1, dt * 2);
      const step = car.speed * dt;
      let nx;
      let ny;
      if (car.axis === 'h') {
        nx = car.x + car.dir * step;
        ny = car.y + (ty - car.y) * Math.min(1, dt * 3);
        car.angle = car.dir > 0 ? 0 : Math.PI;
      } else {
        nx = car.x + (tx - car.x) * Math.min(1, dt * 3);
        ny = car.y + car.dir * step;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      // Turn at an intersection sometimes; bounce off the world edge.
      const atJunction = Math.abs(nx - nearestRoadX(nx)) < 60 && Math.abs(ny - nearestRoadY(ny)) < 60;
      if (atJunction && this.rng.chance(dt * 0.25)) {
        car.axis = car.axis === 'h' ? 'v' : 'h';
        car.dir = this.rng.chance(0.5) ? 1 : -1;
        car.lane = this.rng.chance(0.5) ? -26 : 26;
      }
      if (nx < 60 || nx > WORLD_SIZE - 60) {
        car.dir *= -1;
        nx = Math.max(60, Math.min(WORLD_SIZE - 60, nx));
      }
      if (ny < 60 || ny > WORLD_SIZE - 60) {
        car.dir *= -1;
        ny = Math.max(60, Math.min(WORLD_SIZE - 60, ny));
      }
      if (!isBlocked(this.city, nx, ny, 22)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.dir *= -1;
      }
      // Light collision with the player on foot: shove, don't kill.
      if (player && player.onFoot) {
        const d = Math.hypot(player.x - car.x, player.y - car.y);
        if (d < 34 && car.speed > 60) {
          player.damage(8, world, 'traffic');
          car.speed *= 0.4;
        }
      }
    }

    for (const ped of this.peds) {
      if (ped.fleeT > 0) {
        ped.fleeT -= dt;
        ped.speed = TUNING.pedSpeed * 2.6;
        if (ped.fleeT <= 0) ped.state = 'walk';
      } else {
        ped.speed = TUNING.pedSpeed;
      }
      // Wander: pick a new heading now and then, stay out of buildings.
      if (this.rng.chance(dt * 0.25)) ped.angle += this.rng.range(-1.1, 1.1);
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      const moved = moveWithCollision(this.city, ped.x, ped.y, nx - ped.x, ny - ped.y, 10);
      ped.x = moved.x;
      ped.y = moved.y;
      if (moved.hit) ped.angle += Math.PI / 2;
    }
  }
}

function nearestRoadY(y) {
  let best = ROAD_CENTERS[0];
  for (const c of ROAD_CENTERS) {
    if (Math.abs(y - c) < Math.abs(y - best)) best = c;
  }
  return best;
}

function nearestRoadX(x) {
  return nearestRoadY(x);
}
