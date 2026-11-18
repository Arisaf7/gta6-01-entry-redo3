// SOLMARA: Dario Reyes, on foot and behind the wheel.
// On foot he walks, runs with Shift, punches with F and shoots with Space
// or a mouse click (when he has ammo). Near a car, E steals it / gets in;
// E again steps out. Driving is simple arcade physics: accelerate, steer,
// brake, drift a little, and wreck the car if it takes too much damage.

import { TUNING, clamp, angleDelta } from './config.js';
import { moveWithCollision } from './city.js';

export class Player {
  constructor(city) {
    this.city = city;
    this.x = 225;
    this.y = 340;
    this.angle = 0;
    this.speed = 0;
    this.onFoot = true;
    this.car = null;
    this.health = TUNING.playerHealth;
    this.cash = 0;
    this.ammo = 24;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.hurtCooldown = 0;
    this.dead = false;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.speed = 0;
    this.onFoot = true;
    this.car = null;
    this.health = TUNING.playerHealth;
    this.ammo = 24;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.dead = false;
  }

  damage(n, world, source) {
    if (this.dead || this.hurtCooldown > 0) return;
    this.health -= n;
    this.hurtCooldown = 0.5;
    world.addParticles(this.x, this.y, 8, '#ff4757');
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      world.gameOver(source === 'police' ? 'busted' : 'wasted');
    }
  }

  heal(n) {
    this.health = Math.min(TUNING.playerHealth, this.health + n);
  }

  enterCar(car, world) {
    if (!car) return false;
    if (car.parked) {
      car.parked = false;
      world.traffic.cars.push(car);
      const idx = world.traffic.parkedCars.indexOf(car);
      if (idx >= 0) world.traffic.parkedCars.splice(idx, 1);
      world.police.addHeat(12);
      world.addToast('Car borrowed. The owner will notice eventually.');
    } else {
      world.police.addHeat(8);
      world.addToast('Car jacked!');
    }
    world.traffic.scare(car.x, car.y, 160);
    this.car = car;
    this.onFoot = false;
    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
    this.speed = 0;
    world.audio.horn();
    return true;
  }

  exitCar(world, wrecked = false) {
    if (!this.car) return;
    const car = this.car;
    car.speed = 0;
    // Step out to the side of the car.
    const sx = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    const sy = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    this.x = sx;
    this.y = sy;
    this.angle = car.angle;
    this.car = null;
    this.onFoot = true;
    this.speed = 0;
    if (wrecked) {
      world.addParticles(car.x, car.y, 26, '#ff9f43');
      world.audio.crash();
    }
  }

  punch(world) {
    if (this.punchCooldown > 0 || !this.onFoot) return;
    this.punchCooldown = 0.45;
    world.audio.punch();
    const px = this.x + Math.cos(this.angle) * 34;
    const py = this.y + Math.sin(this.angle) * 34;
    world.addParticles(px, py, 6, '#ffeaa7');
    // Rivals first, then pedestrians (who just get scared and run).
    const rival = world.nearestRival(px, py, TUNING.punchRange + 14);
    if (rival) {
      rival.health -= TUNING.punchDamage;
      world.addParticles(rival.x, rival.y, 10, '#ff4757');
      if (rival.health <= 0) world.removeRival(rival);
      return;
    }
    const ped = world.traffic.nearestPed(px, py, TUNING.punchRange);
    if (ped) {
      world.traffic.scare(ped.x, ped.y, 220);
      world.police.addHeat(6);
    }
  }

  shoot(world) {
    if (this.shootCooldown > 0 || this.ammo <= 0) return;
    this.shootCooldown = 0.28;
    this.ammo -= 1;
    world.audio.shoot();
    world.police.addHeat(4);
    const ox = this.x + Math.cos(this.angle) * 22;
    const oy = this.y + Math.sin(this.angle) * 22;
    world.spawnBullet(ox, oy, this.angle);
    world.addParticles(ox, oy, 4, '#f5d76e');
  }

  update(dt, input, world) {
    if (this.dead) return;
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);

    for (const action of input.takePlayerActions()) {
      if (action === 'interact') {
        if (this.onFoot) {
          const car = world.traffic.nearestCar(this.x, this.y, 64);
          if (car) this.enterCar(car, world);
        } else {
          this.exitCar(world);
        }
      } else if (action === 'punch') {
        this.punch(world);
      } else if (action === 'shoot') {
        if (this.onFoot) this.shoot(world);
      } else if (action === 'horn') {
        if (!this.onFoot) world.audio.horn();
      }
    }

    const move = input.moveVector();
    if (this.onFoot) {
      const run = input.isRunning();
      const speed = run ? TUNING.runSpeed : TUNING.walkSpeed;
      if (move.x !== 0 || move.y !== 0) {
        this.angle = Math.atan2(move.y, move.x);
        const moved = moveWithCollision(
          this.city,
          this.x, this.y,
          move.x * speed * dt, move.y * speed * dt,
          TUNING.playerRadius,
        );
        this.x = moved.x;
        this.y = moved.y;
        this.speed = speed;
      } else {
        this.speed = 0;
      }
      // Aim with the mouse while standing still and clicking.
      if (input.mouse.clicked) {
        const wx = world.camera.x + input.mouse.x - world.viewW / 2;
        const wy = world.camera.y + input.mouse.y - world.viewH / 2;
        this.angle = Math.atan2(wy - this.y, wx - this.x);
      }
    } else if (this.car) {
      const car = this.car;
      const forward = move.y !== 0 ? -move.y : 0;
      const steering = move.x;
      if (forward > 0) {
        car.speed += TUNING.carAccel * dt;
      } else if (forward < 0) {
        car.speed -= (car.speed > 0 ? TUNING.carBrake : TUNING.carAccel * 0.5) * dt;
      } else {
        car.speed *= Math.pow(0.4, dt);
        if (Math.abs(car.speed) < 4) car.speed = 0;
      }
      car.speed = clamp(car.speed, -TUNING.carReverse, TUNING.carMaxSpeed);
      const turnAuthority = clamp(Math.abs(car.speed) / 140, 0, 1);
      car.angle += steering * TUNING.carTurn * turnAuthority * dt * Math.sign(car.speed || 1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const moved = moveWithCollision(this.city, car.x, car.y, nx - car.x, ny - car.y, 22);
      if (moved.hit && Math.abs(car.speed) > 180) {
        car.speed *= -0.25;
        car.health -= 6;
        world.audio.crash();
        world.addParticles(car.x, car.y, 10, '#dfe6e9');
        if (car.health <= 0) {
          this.exitCar(world, true);
          return;
        }
      } else {
        car.speed *= moved.hit ? 0.5 : 1;
      }
      car.x = moved.x;
      car.y = moved.y;
      this.x = car.x;
      this.y = car.y;
      this.angle = car.angle;
      this.speed = car.speed;
      // Running over a pedestrian is a crime, and it shows.
      const ped = world.traffic.nearestPed(car.x, car.y, 30);
      if (ped && Math.abs(car.speed) > 80) {
        world.traffic.peds.splice(world.traffic.peds.indexOf(ped), 1);
        world.police.addHeat(30);
        world.addParticles(ped.x, ped.y, 14, '#ff4757');
        world.audio.crash();
      }
    }
  }
}
