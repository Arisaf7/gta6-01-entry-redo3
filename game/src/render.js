// SOLMARA: rendering — the top-down camera, the city, and the HUD.
// One canvas for the world plus the HUD and minimap; the menu screens
// (title, briefing, pause, game over) are DOM overlays managed by main.js.
// Everything is drawn with plain canvas shapes: no image assets at all.

import {
  WORLD_SIZE, ROAD_WIDTH, ROAD_CENTERS, COLORS, TUNING, GARAGE, BANK,
  HOTEL, PARK, DOCKS_X, BEACH_Y, clamp,
} from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.viewW = 1280;
    this.viewH = 720;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.world.viewW = w;
    this.world.viewH = h;
  }

  draw() {
    const { ctx, world } = this;
    const cam = world.camera;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    ctx.save();
    const scale = cam.zoom;
    ctx.translate(this.viewW / 2 - cam.x * scale, this.viewH / 2 - cam.y * scale);
    ctx.scale(scale, scale);
    this._drawGround(ctx, cam);
    this._drawRoads(ctx);
    this._drawZones(ctx);
    this._drawBuildings(ctx);
    this._drawCars(ctx);
    this._drawPeds(ctx);
    this._drawRivals(ctx);
    this._drawBullets(ctx);
    this._drawPlayer(ctx);
    this._drawParticles(ctx);
    ctx.restore();
    this._drawHud(ctx);
    this._drawMinimap(ctx);
  }

  _drawGround(ctx, cam) {
    // Grass base, then sand and sea along the south edge.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(cam.x - this.viewW, cam.y - this.viewH, this.viewW * 2, this.viewH * 2);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(0, BEACH_Y, WORLD_SIZE, WORLD_SIZE - BEACH_Y);
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(0, WORLD_SIZE - 130, WORLD_SIZE, 130);
    ctx.fillStyle = COLORS.seaDeep;
    ctx.fillRect(0, WORLD_SIZE - 60, WORLD_SIZE, 60);
    // Docks: wooden piers on the east edge.
    ctx.fillStyle = '#8a6d4b';
    for (let y = 120; y < BEACH_Y; y += 320) {
      ctx.fillRect(DOCKS_X + 40, y, 260, 46);
    }
  }

  _drawRoads(ctx) {
    ctx.fillStyle = COLORS.asphalt;
    for (const c of ROAD_CENTERS) {
      ctx.fillRect(0, c - ROAD_WIDTH / 2, WORLD_SIZE, ROAD_WIDTH);
      ctx.fillRect(c - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_SIZE);
    }
    // Centre dashes.
    ctx.strokeStyle = COLORS.lane;
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (const c of ROAD_CENTERS) {
      ctx.moveTo(0, c);
      ctx.lineTo(WORLD_SIZE, c);
      ctx.moveTo(c, 0);
      ctx.lineTo(c, WORLD_SIZE);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Sidewalk edges.
    ctx.strokeStyle = COLORS.sidewalk;
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (const c of ROAD_CENTERS) {
      const o = ROAD_WIDTH / 2 + 4;
      ctx.moveTo(0, c - o);
      ctx.lineTo(WORLD_SIZE, c - o);
      ctx.moveTo(0, c + o);
      ctx.lineTo(WORLD_SIZE, c + o);
      ctx.moveTo(c - o, 0);
      ctx.lineTo(c - o, WORLD_SIZE);
      ctx.moveTo(c + o, 0);
      ctx.lineTo(c + o, WORLD_SIZE);
    }
    ctx.stroke();
  }

  _drawZones(ctx) {
    const { city } = this.world;
    // Palmera Park: lawn, pond, palm dots.
    ctx.fillStyle = COLORS.park;
    ctx.beginPath();
    ctx.arc(PARK.x, PARK.y, PARK.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7ec8e3';
    ctx.beginPath();
    ctx.arc(PARK.x - 40, PARK.y + 30, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.parkTree;
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2;
      const px = PARK.x + Math.cos(a) * (PARK.r - 34);
      const py = PARK.y + Math.sin(a) * (PARK.r - 34);
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    this._drawLabel(ctx, 'PALMERA PARK', PARK.x, PARK.y - PARK.r - 14, '#e8f5e9');
    // Beach label and umbrellas.
    ctx.fillStyle = '#ff8f5e';
    for (let x = 300; x < WORLD_SIZE; x += 420) {
      ctx.beginPath();
      ctx.arc(x, BEACH_Y + 70, 22, Math.PI, 0);
      ctx.fill();
    }
    this._drawLabel(ctx, 'SOUTH BEACH', 600, BEACH_Y + 150, '#7a4a21');
    this._drawLabel(ctx, 'DOCKS', DOCKS_X + 150, 240, '#e8e4da');
    // Landmark pads.
    this._drawPad(ctx, GARAGE.x, GARAGE.y, GARAGE.r, '#ffd166', "ROSA'S GARAGE");
    this._drawPad(ctx, BANK.x, BANK.y, BANK.r, '#ffe9a8', 'FIRST BANK');
    this._drawPad(ctx, HOTEL.x, HOTEL.y, HOTEL.r, '#ffe9a8', 'HOTEL MIRAMONTE');
    void city;
  }

  _drawPad(ctx, x, y, r, color, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    this._drawLabel(ctx, label, x, y - r - 12, color);
  }

  _drawLabel(ctx, text, x, y, color) {
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  _drawBuildings(ctx) {
    for (const b of this.world.city.buildings) {
      // Drop shadow for tall buildings.
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
      }
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, 10);
      if (b.landmark) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const name = b.landmark === 'garage' ? 'GARAGE' : b.landmark === 'bank' ? 'BANK' : 'HOTEL';
        ctx.fillText(name, b.x + b.w / 2, b.y + b.h / 2 + 8);
      }
    }
  }

  _drawCarShape(ctx, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const len = car.model === 'van' ? 62 : car.model === 'pickup' ? 58 : 52;
    const wid = car.model === 'van' ? 30 : 26;
    // Shadow and wheels.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -len / 2 + 3, -wid / 2 + 3, len, wid, 8);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    const wheelY = wid / 2 - 2;
    ctx.fillRect(-len / 2 + 6, -wheelY - 4, 12, 6);
    ctx.fillRect(len / 2 - 18, -wheelY - 4, 12, 6);
    ctx.fillRect(-len / 2 + 6, wheelY - 2, 12, 6);
    ctx.fillRect(len / 2 - 18, wheelY - 2, 12, 6);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(30,40,60,0.85)';
    roundRect(ctx, -len / 6, -wid / 2 + 5, len / 3, wid - 10, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(len / 2 - 10, -wid / 2 + 4, 4, wid - 8);
    if (car.model === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 4);
    }
    if (car.model === 'cruiser') {
      const flash = Math.floor(this.world.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2d2d' : '#2d7bff';
      ctx.fillRect(-4, -wid / 2 - 2, 8, 6);
      ctx.fillStyle = flash ? '#2d7bff' : '#ff2d2d';
      ctx.fillRect(-4, wid / 2 - 4, 8, 6);
    }
    if (car.health < 45) {
      ctx.fillStyle = 'rgba(120,120,120,0.7)';
      ctx.beginPath();
      ctx.arc(-len / 2 + 8, 0, 7 + Math.sin(this.world.time * 9) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawCars(ctx) {
    for (const car of this.world.traffic.allCars()) {
      if (car.health <= 0) continue;
      this._drawCarShape(ctx, car);
    }
    for (const cop of this.world.police.cops) {
      this._drawCarShape(ctx, cop);
    }
  }

  _drawPeds(ctx) {
    for (const ped of this.world.traffic.peds) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(ped.x + 2, ped.y + 3, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawRivals(ctx) {
    for (const r of this.world.rivals) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(r.x + 2, r.y + 3, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5b2d8e';
      ctx.beginPath();
      ctx.arc(r.x, r.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GULL', r.x, r.y - 16);
      // Health bar.
      ctx.fillStyle = '#222';
      ctx.fillRect(r.x - 14, r.y + 14, 28, 5);
      ctx.fillStyle = '#ff4757';
      ctx.fillRect(r.x - 14, r.y + 14, 28 * Math.max(0, r.health / 100), 5);
    }
  }

  _drawBullets(ctx) {
    ctx.fillStyle = '#ffe66d';
    for (const b of this.world.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawPlayer(ctx) {
    const p = this.world.player;
    if (p.dead) return;
    if (!p.onFoot) {
      // A small marker ring so the player's car reads at a glance.
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 4, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dario: teal jacket, dark jeans, facing his angle.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(6, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -4, 8, 3);
    ctx.fillRect(8, 1, 8, 3);
    ctx.restore();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawParticles(ctx) {
    for (const pt of this.world.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawHud(ctx) {
    const w = this.world;
    const p = w.player;
    ctx.textAlign = 'left';
    // Top-left panel: cash, health, ammo, speed.
    ctx.fillStyle = 'rgba(10,14,18,0.72)';
    roundRect(ctx, 12, 12, 250, 108, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`$${p.cash}`, 26, 44);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(p.onFoot ? 'ON FOOT' : `DRIVING  ${Math.abs(Math.round(p.speed * 2.4))} km/h`, 26, 66);
    // Health bar.
    ctx.fillStyle = '#333';
    ctx.fillRect(26, 78, 150, 12);
    ctx.fillStyle = p.health > 40 ? '#2ecc71' : '#ff4757';
    ctx.fillRect(26, 78, 150 * clamp(p.health / 100, 0, 1), 12);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`HP ${Math.ceil(p.health)}   Ammo ${p.ammo}`, 186, 89);
    // Wanted stars, top-right of the panel row.
    ctx.fillStyle = 'rgba(10,14,18,0.72)';
    roundRect(ctx, 12, 128, 250, 44, 10);
    ctx.fill();
    ctx.font = 'bold 22px system-ui, sans-serif';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < w.police.wanted ? COLORS.accent : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', 30 + i * 34, 160);
    }
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(w.police.wanted > 0 ? 'WANTED' : 'CLEAN', 200, 158);
    // Mission line across the top centre.
    const missionText = w.missions.statusText();
    ctx.font = 'bold 17px system-ui, sans-serif';
    const mw = ctx.measureText(missionText).width;
    ctx.fillStyle = 'rgba(10,14,18,0.72)';
    roundRect(ctx, this.viewW / 2 - mw / 2 - 14, 12, mw + 28, 36, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(missionText, this.viewW / 2, 36);
    ctx.textAlign = 'left';
    // Toasts under the mission line.
    ctx.font = '15px system-ui, sans-serif';
    w.toasts.forEach((t, i) => {
      ctx.globalAlpha = clamp(t.t, 0, 1);
      const tw = ctx.measureText(t.text).width;
      ctx.fillStyle = 'rgba(10,14,18,0.72)';
      roundRect(ctx, this.viewW / 2 - tw / 2 - 10, 56 + i * 30, tw + 20, 24, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, this.viewW / 2, 73 + i * 30);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    });
    // Controls hint, bottom-left.
    ctx.fillStyle = 'rgba(10,14,18,0.6)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('WASD move · Shift run · E enter/exit car · F punch · Space/click shoot · P pause · M mute', 14, this.viewH - 14);
    // Objective arrow at the screen edge when the marker is off-screen.
    const obj = w.missions.objectivePos(w);
    if (obj && w.state === 'play') {
      const sx = this.viewW / 2 + (obj.x - w.camera.x);
      const sy = this.viewH / 2 + (obj.y - w.camera.y);
      const onScreen = sx > 60 && sx < this.viewW - 60 && sy > 60 && sy < this.viewH - 60;
      if (!onScreen) {
        const cx = clamp(sx, 60, this.viewW - 60);
        const cy = clamp(sy, 60, this.viewH - 60);
        const a = Math.atan2(sy - this.viewH / 2, sx - this.viewW / 2);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.fillStyle = COLORS.accent;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = COLORS.accent;
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(Math.hypot(obj.x - p.x, obj.y - p.y))}m`, cx, cy + 28);
        ctx.textAlign = 'left';
      } else {
        // Pulsing diamond right on the objective.
        const pulse = 10 + Math.sin(w.time * 4) * 4;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
        ctx.restore();
      }
    }
  }

  _drawMinimap(ctx) {
    const size = TUNING.minimapSize;
    const x0 = this.viewW - size - 14;
    const y0 = 14;
    const s = size / WORLD_SIZE;
    ctx.fillStyle = 'rgba(10,14,18,0.78)';
    roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(x0, y0 + BEACH_Y * s, size, size - BEACH_Y * s);
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(x0, y0 + (WORLD_SIZE - 130) * s, size, 130 * s);
    ctx.fillStyle = COLORS.park;
    ctx.beginPath();
    ctx.arc(x0 + PARK.x * s, y0 + PARK.y * s, PARK.r * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    for (const c of ROAD_CENTERS) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + c * s);
      ctx.lineTo(x0 + size, y0 + c * s);
      ctx.moveTo(x0 + c * s, y0);
      ctx.lineTo(x0 + c * s, y0 + size);
      ctx.stroke();
    }
    const dot = (x, y, color, r = 3) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x0 + x * s, y0 + y * s, r, 0, Math.PI * 2);
      ctx.fill();
    };
    dot(GARAGE.x, GARAGE.y, '#ffd166', 4);
    dot(BANK.x, BANK.y, '#fff', 4);
    dot(HOTEL.x, HOTEL.y, '#7ec8e3', 4);
    const obj = this.world.missions.objectivePos(this.world);
    if (obj) dot(obj.x, obj.y, '#ff4757', 5);
    for (const cop of this.world.police.cops) dot(cop.x, cop.y, '#2d7bff', 3);
    dot(this.world.player.x, this.world.player.y, '#fff', 4);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x0 + this.world.player.x * s, y0 + this.world.player.y * s, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMARA', x0 + size / 2, y0 + size + 20);
    ctx.textAlign = 'left';
  }
}
