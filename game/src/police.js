// SOLMARA: the wanted system and the Solmara Police Department.
// Wanted stars 0-5. Crimes add heat; heat raises stars. Cops spawn at the
// edge of the camera view, chase the player, and ram. On foot, a cop who
// stays close long enough busts the player; in a car the cops try to spin
// the player out. Stars decay only while no cop can see the player.

import { WORLD_SIZE, TUNING } from './config.js';
import { angleDelta } from './config.js';
import { Rng } from './random.js';

const COP_COLOR = '#1e5fd6';
const WANTED_FOR_STAR = [0, 25, 60, 110, 175, 260];

export class Police {
  constructor(city, seed) {
    this.city = city;
    this.rng = new Rng(seed + 303);
    this.wanted = 0;
    this.heat = 0;
    this.cops = [];
    this.hiddenTimer = 0;
    this.bustedTimer = 0;
    this.spawnTimer = 0;
  }

  reset() {
    this.wanted = 0;
    this.heat = 0;
    this.cops = [];
    this.hiddenTimer = 0;
    this.bustedTimer = 0;
  }

  addHeat(n) {
    this.heat += n;
    for (let s = 5; s >= 1; s -= 1) {
      if (this.heat >= WANTED_FOR_STAR[s]) {
        if (s > this.wanted) this.wanted = s;
        break;
      }
    }
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.heat = WANTED_FOR_STAR[this.wanted] || 0;
  }

  clearWanted() {
    this.wanted = 0;
    this.heat = 0;
    this.cops = [];
    this.bustedTimer = 0;
  }

  copTargetCount() {
    return this.wanted === 0 ? 0 : Math.min(2 + this.wanted, 7);
  }

  _spawnCopNear(player) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = 700 + this.rng.range(0, 250);
    const x = Math.max(80, Math.min(WORLD_SIZE - 80, player.x + Math.cos(angle) * dist));
    const y = Math.max(80, Math.min(WORLD_SIZE - 80, player.y + Math.sin(angle) * dist));
    const cop = {
      x, y,
      angle: Math.atan2(player.y - y, player.x - x),
      speed: 0,
      color: COP_COLOR,
      model: 'cruiser',
      state: 'chase',
      ramCooldown: 0,
    };
    this.cops.push(cop);
    return cop;
  }

  // How close the nearest cop is; Infinity when the streets are clear.
  nearestCopDist(x, y) {
    let best = Infinity;
    for (const cop of this.cops) {
      const d = Math.hypot(cop.x - x, cop.y - y);
      if (d < best) best = d;
    }
    return best;
  }

  update(dt, world) {
    const player = world.player;
    if (!player) return;

    // Keep the squad at the size the wanted level demands.
    this.spawnTimer -= dt;
    if (this.cops.length < this.copTargetCount() && this.spawnTimer <= 0) {
      this._spawnCopNear(player);
      this.spawnTimer = 1.2;
    }
    if (this.cops.length > this.copTargetCount()) {
      this.cops.length = this.copTargetCount();
    }

    // Visibility: any cop within 620 units counts as seeing the player.
    const nearest = this.nearestCopDist(player.x, player.y);
    const seen = this.wanted > 0 && nearest < 620;
    if (seen) this.hiddenTimer = 0;
    else this.hiddenTimer += dt;

    // Stars decay after hiding long enough; the heat drains with them.
    if (this.wanted > 0 && this.hiddenTimer > TUNING.wantedDecaySeconds) {
      this.wanted -= 1;
      this.heat = WANTED_FOR_STAR[this.wanted] || 0;
      this.hiddenTimer = 0;
      world.addToast(this.wanted === 0 ? 'You lost the cops.' : `Heat dropping — ${this.wanted} star${this.wanted > 1 ? 's' : ''} left.`);
    }

    // Chase behaviour: steer toward the player, ram on contact.
    for (const cop of this.cops) {
      const targetAngle = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle += angleDelta(cop.angle, targetAngle) * Math.min(1, dt * 3.2);
      const wantSpeed = Math.min(TUNING.copMaxSpeed, 380 + this.wanted * 42);
      cop.speed += (wantSpeed - cop.speed) * Math.min(1, dt * 1.4);
      const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      // Cops drive through the city like traffic: they steer around blocks
      // by sliding along them rather than getting stuck on a corner.
      if (!this._hitsBuilding(nx, ny)) {
        cop.x = nx;
        cop.y = ny;
      } else if (!this._hitsBuilding(cop.x, ny)) {
        cop.y = ny;
      } else if (!this._hitsBuilding(nx, cop.y)) {
        cop.x = nx;
      }
      cop.ramCooldown -= dt;
      const d = Math.hypot(player.x - cop.x, player.y - cop.y);
      if (d < 44 && cop.ramCooldown <= 0) {
        cop.ramCooldown = 1.0;
        if (player.onFoot) {
          player.damage(12, world, 'police');
          world.audio.busted();
        } else if (player.car) {
          player.car.health -= 14;
          world.audio.crash();
          world.addParticles(cop.x, cop.y, 10, '#ffb703');
          if (player.car.health <= 0) {
            world.addToast('Your car is wrecked!');
            player.exitCar(world, true);
          }
        }
      }
    }

    // Busted: on foot, a cop standing on the player for ~1 second ends it.
    if (player.onFoot && this.wanted > 0 && nearest < TUNING.bustedCatchRadius) {
      this.bustedTimer += dt;
      if (this.bustedTimer > TUNING.bustedCatchTime) {
        world.gameOver('busted');
      }
    } else {
      this.bustedTimer = 0;
    }
  }

  _hitsBuilding(x, y) {
    if (x < 30 || y < 30 || x > WORLD_SIZE - 30 || y > WORLD_SIZE - 30) return true;
    for (const b of this.city.buildings) {
      if (x > b.x - 18 && x < b.x + b.w + 18 && y > b.y - 18 && y < b.y + b.h + 18) return true;
    }
    return false;
  }
}
