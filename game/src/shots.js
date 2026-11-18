// SOLMARA: screenshot scenes.
// When the page loads with ?shot=<name>, the world is staged into a fixed,
// seeded scene (a chase, a walk, a mission, the title) and, after the scene
// has rendered for a few frames, document.title becomes 'shot-ready' so the
// screenshot driver knows when to capture. These scenes are only staging:
// they call the same public methods the real game uses.

import { GARAGE, BANK, HOTEL } from './config.js';

const SCENES = {
  // Cover: Dario mid-chase in a stolen sedan, three stars, cops closing in.
  // Staged on the open east-west road at y=2025 (no landmark sits on it),
  // so the car is still at speed when the capture fires.
  chase(world) {
    world.reset();
    world.state = 'play';
    const car = world.traffic.parkedCars[0] || world.traffic.cars[0];
    world.player.x = car.x;
    world.player.y = car.y;
    world.player.enterCar(car, world);
    world.player.car.x = 1400;
    world.player.car.y = 2025;
    world.player.car.angle = 0;
    world.player.car.speed = 560;
    world.player.x = 1400;
    world.player.y = 2025;
    world.camera.x = 1650;
    world.camera.y = 2025;
    world.police.setWanted(3);
    world.police.cops = [];
    // Cops placed in-frame: one on the tail, one cutting across ahead,
    // one sweeping in from the south.
    const spots = [
      { x: 1050, y: 2060 },
      { x: 2150, y: 1990 },
      { x: 1750, y: 2420 },
    ];
    for (const s of spots) {
      const cop = world.police._spawnCopNear(world.player);
      cop.x = s.x;
      cop.y = s.y;
      cop.angle = Math.atan2(world.player.y - s.y, world.player.x - s.x);
      cop.speed = 420;
    }
    world.missions.index = 2;
    world.missions.start(2, world);
    world.missions.stage = 1;
    world.addToast('Satchel grabbed! Run for the docks!');
  },
  // On foot outside Rosa's Garage, pedestrians and traffic around.
  foot(world) {
    world.reset();
    world.state = 'play';
    world.player.x = GARAGE.x + 40;
    world.player.y = GARAGE.y + 190;
    world.player.angle = -Math.PI / 2;
    world.camera.x = world.player.x;
    world.camera.y = world.player.y;
    world.missions.index = 0;
    world.missions.start(0, world);
    world.traffic.scare(world.player.x, world.player.y, 0);
  },
  // Mission in progress at the bank, Dario arriving in a car, a cop
  // already responding from the south road.
  mission(world) {
    world.reset();
    world.state = 'play';
    const car = world.traffic.cars[1] || world.traffic.cars[0];
    world.player.x = car.x;
    world.player.y = car.y;
    world.player.enterCar(car, world);
    world.player.car.x = 1700;
    world.player.car.y = 1125;
    world.player.car.angle = 0;
    world.player.car.speed = 300;
    world.player.x = 1700;
    world.player.y = 1125;
    world.camera.x = 1850;
    world.camera.y = 1125;
    world.missions.index = 2;
    world.missions.start(2, world);
    world.police.setWanted(1);
    const cop = world.police._spawnCopNear(world.player);
    cop.x = 1500;
    cop.y = 1420;
    cop.angle = Math.atan2(world.player.y - 1420, world.player.x - 1500);
    cop.speed = 380;
  },
  // The title screen, untouched.
  title(world) {
    world.reset();
    world.state = 'title';
    world.camera.x = HOTEL.x;
    world.camera.y = HOTEL.y;
  },
};

export function applyShotScene(world, params) {
  const name = params.get('shot');
  if (!name || !SCENES[name]) return false;
  SCENES[name](world);
  return true;
}

// Count rendered frames, then signal the driver. A fixed frame count keeps
// captures deterministic across machines.
export function makeShotReady(frames = 90) {
  let left = frames;
  return function tick() {
    left -= 1;
    if (left <= 0) {
      document.title = 'shot-ready';
      return true;
    }
    return false;
  };
}
