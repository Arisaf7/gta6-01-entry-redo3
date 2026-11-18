// SOLMARA: the world — one object holding every system, the game state
// machine, and the frame update. States: title → briefing → play ⇄ pause →
// gameover (wasted / busted) → restart, plus win when the story ends.
// reset() is careful by design: it restores the player, police, missions and
// dynamic traffic, but it NEVER rebuilds the city or the parked cars — a
// restart must not reshuffle the street (an earlier prototype re-rolled its
// parked cars on every startGame, which broke mission continuity).

import {
  WORLD_SIZE, GARAGE, TUNING, clamp,
} from './config.js';
import { Rng } from './random.js';
import { buildCity } from './city.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { MissionSys } from './missions.js';
import { Player } from './player.js';
import { SaveSys } from './save.js';

export class World {
  constructor(seed, audio) {
    this.seed = seed;
    this.audio = audio;
    this.city = buildCity(seed);
    this.traffic = new Traffic(this.city, seed);
    this.police = new Police(this.city, seed);
    this.missions = new MissionSys();
    this.player = new Player(this.city);
    this.save = new SaveSys();
    this.state = 'title';
    this.time = 0;
    this.score = 0;
    this.camera = { x: GARAGE.x, y: GARAGE.y, zoom: 1 };
    this.viewW = 1280;
    this.viewH = 720;
    this.bullets = [];
    this.particles = [];
    this.rivals = [];
    this.toasts = [];
    this.gameOverReason = '';
    this._rng = new Rng(seed + 909);
    this._saved = this.save.load();
    if (this._saved) {
      this.player.cash = this._saved.cash || 0;
      this.missions.index = Math.min(this._saved.missionIndex || 0, 5);
      this.missions.completed = (this._saved.completed || []).slice();
    }
  }

  // Fresh dynamic state, same streets: parked cars and buildings stay.
  reset() {
    this.player.reset(GARAGE.x, GARAGE.y + 130);
    this.player.cash = this._saved ? this._saved.cash || 0 : 0;
    this.police.reset();
    this.traffic.resetDynamic();
    this.missions.active = false;
    this.missions.progress = 0;
    this.missions.stage = 0;
    this.missions.timer = 0;
    this.bullets = [];
    this.particles = [];
    this.rivals = [];
    this.toasts = [];
    this.time = 0;
    this.gameOverReason = '';
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
  }

  startGame() {
    this.reset();
    this.state = 'briefing';
  }

  beginMission() {
    const def = this.missions.current();
    if (!def) {
      this.state = 'play';
      return;
    }
    this.missions.start(this.missions.index, this);
    this.state = 'play';
  }

  pauseGame() {
    if (this.state === 'play') this.state = 'pause';
  }

  resumeGame() {
    if (this.state === 'pause') this.state = 'play';
  }

  gameOver(reason) {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.gameOverReason = reason;
    this.audio.busted();
    this.saveGame();
  }

  winGame() {
    this.state = 'win';
    this.saveGame();
  }

  saveGame() {
    this.save.save({
      cash: this.player.cash,
      missionIndex: this.missions.index,
      completed: this.missions.completed,
      bestScore: this.score,
    });
  }

  addToast(text) {
    this.toasts.push({ text, t: 4 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  addParticles(x, y, n, color) {
    for (let i = 0; i < n; i += 1) {
      const a = this._rng.range(0, Math.PI * 2);
      const s = this._rng.range(40, 220);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: this._rng.range(0.3, 0.8),
        maxLife: 0.8,
        color,
        size: this._rng.range(2, 5),
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  spawnBullet(x, y, angle) {
    this.bullets.push({
      x, y,
      vx: Math.cos(angle) * TUNING.bulletSpeed,
      vy: Math.sin(angle) * TUNING.bulletSpeed,
      life: TUNING.bulletLife,
    });
  }

  spawnRivals(n, cx, cy, spread) {
    this.rivals = [];
    for (let i = 0; i < n; i += 1) {
      this.rivals.push({
        x: clamp(cx + this._rng.range(-spread, spread), 60, WORLD_SIZE - 60),
        y: clamp(cy + this._rng.range(-spread, spread), 60, WORLD_SIZE - 60),
        angle: this._rng.range(0, Math.PI * 2),
        speed: 95,
        health: 100,
        attackCooldown: 0,
      });
    }
  }

  nearestRival(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const r of this.rivals) {
      const d = Math.hypot(r.x - x, r.y - y);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  }

  removeRival(rival) {
    const idx = this.rivals.indexOf(rival);
    if (idx >= 0) this.rivals.splice(idx, 1);
    this.addParticles(rival.x, rival.y, 18, '#a29bfe');
    this.missions.onRivalDown(this);
    this.player.cash += 25;
  }

  update(dt, input) {
    // UI screens consume UI actions only; gameplay consumes player actions
    // only. The two queues are read in exactly one place each, per frame.
    if (this.state === 'title') {
      for (const a of input.takeUiActions()) {
        if (a === 'confirm') {
          this.audio.unlock();
          this.audio.click();
          this.startGame();
        }
      }
      this.time += dt;
      return;
    }
    if (this.state === 'briefing') {
      for (const a of input.takeUiActions()) {
        if (a === 'confirm') {
          this.audio.click();
          this.beginMission();
        } else if (a === 'back') {
          this.state = 'title';
        }
      }
      this.time += dt;
      return;
    }
    if (this.state === 'pause') {
      for (const a of input.takeUiActions()) {
        if (a === 'pause' || a === 'back' || a === 'confirm') {
          this.audio.click();
          this.resumeGame();
        } else if (a === 'restart') {
          this.startGame();
        } else if (a === 'mute') {
          this.audio.setMuted(!this.audio.muted);
        }
      }
      return;
    }
    if (this.state === 'gameover' || this.state === 'win') {
      for (const a of input.takeUiActions()) {
        if (a === 'confirm' || a === 'restart') {
          this.audio.click();
          this.startGame();
        }
      }
      this.time += dt;
      return;
    }

    // Playing. Menu keys still work, but the mouse click is left queued
    // for the player (shoot) — see Input.takeUiActions(keepMouse).
    for (const a of input.takeUiActions(true)) {
      if (a === 'pause' || a === 'back') {
        this.pauseGame();
      } else if (a === 'mute') {
        this.audio.setMuted(!this.audio.muted);
      }
    }
    this.time += dt;
    this.player.update(dt, input, this);
    if (this.state !== 'play') return; // player may have ended the game
    this.traffic.update(dt, this);
    this.police.update(dt, this);
    if (this.state !== 'play') return;
    this.missions.update(dt, this);
    this._updateBullets(dt);
    this._updateRivals(dt);
    this._updateParticles(dt);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    // Camera eases toward the player and looks slightly ahead of motion.
    const lookX = this.player.x + Math.cos(this.player.angle) * this.player.speed * 0.12;
    const lookY = this.player.y + Math.sin(this.player.angle) * this.player.speed * 0.12;
    this.camera.x += (lookX - this.camera.x) * Math.min(1, dt * 4);
    this.camera.y += (lookY - this.camera.y) * Math.min(1, dt * 4);
    this.camera.x = clamp(this.camera.x, 0, WORLD_SIZE);
    this.camera.y = clamp(this.camera.y, 0, WORLD_SIZE);
    this.audio.update(dt, {
      driving: !this.player.onFoot,
      speedNorm: clamp(Math.abs(this.player.speed) / TUNING.carMaxSpeed, 0, 1),
      wanted: this.police.wanted,
    });
    this.score = this.player.cash + this.missions.completed.length * 500;
  }

  _updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      // Hit a rival.
      const rival = this.nearestRival(b.x, b.y, 20);
      if (rival) {
        rival.health -= TUNING.gunDamage;
        b.life = 0;
        this.addParticles(b.x, b.y, 8, '#ff4757');
        if (rival.health <= 0) this.removeRival(rival);
        continue;
      }
      // Hit a traffic car: it takes damage and may explode.
      const car = this.traffic.nearestCar(b.x, b.y, 24, true);
      if (car && car.health > 0) {
        car.health -= TUNING.gunDamage;
        b.life = 0;
        this.addParticles(b.x, b.y, 8, '#f5d76e');
        this.police.addHeat(10);
        if (car.health <= 0) {
          this.addParticles(car.x, car.y, 30, '#ff9f43');
          this.audio.crash();
          car.parked = false;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  _updateRivals(dt) {
    const p = this.player;
    for (const r of this.rivals.slice()) {
      const d = Math.hypot(p.x - r.x, p.y - r.y);
      r.attackCooldown -= dt;
      if (d < 420) {
        r.angle = Math.atan2(p.y - r.y, p.x - r.x);
        const nx = r.x + Math.cos(r.angle) * r.speed * dt;
        const ny = r.y + Math.sin(r.angle) * r.speed * dt;
        if (Math.hypot(nx - p.x, ny - p.y) > 26) {
          r.x = nx;
          r.y = ny;
        }
        if (d < 40 && r.attackCooldown <= 0) {
          r.attackCooldown = 0.9;
          p.damage(9, this, 'rival');
        }
      } else {
        // Idle patrol when the player is far away.
        r.angle += dt * 0.5;
        r.x += Math.cos(r.angle) * 30 * dt;
        r.y += Math.sin(r.angle) * 30 * dt;
      }
    }
  }

  _updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.2, dt);
      pt.vy *= Math.pow(0.2, dt);
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }
}
