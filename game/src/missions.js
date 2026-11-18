// SOLMARA: the story — five jobs from Mama Rosa.
// Dario Reyes came back to Solmara owing the wrong people money. Mama Rosa,
// who runs the garage on Palmera Ave and knows everybody, gives him work.
// Each mission is a small contract: a target place or a count to reach, an
// optional timer, and a cash reward. Finishing all five is the story's end.

import { GARAGE, BANK, HOTEL, DOCKS_X, BEACH_Y } from './config.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    brief: 'Mama Rosa: "Dario, mijo, you came back with nothing but the shirt on your back. Take any car on the street — borrow it, permanently — and bring it to my garage. That is job one."',
    objective: 'Steal any car and drive it into Rosa\'s Garage',
    target: { type: 'reach-in-car', x: GARAGE.x, y: GARAGE.y, r: GARAGE.r },
    reward: 250,
    timeLimit: 0,
  },
  {
    id: 'sunset-courier',
    title: 'Sunset Courier',
    brief: 'Mama Rosa: "A package needs to reach the Hotel Miramonte before sunset, and the regular courier got cold feet. Drive fast, drive smooth, and do not open it. 90 seconds, Dario."',
    objective: 'Deliver the package to the Hotel Miramonte',
    target: { type: 'reach', x: HOTEL.x, y: HOTEL.y, r: HOTEL.r },
    reward: 400,
    timeLimit: 90,
  },
  {
    id: 'bank-jitters',
    title: 'Bank Jitters',
    brief: 'Mama Rosa: "The First Bank of Solmara keeps a satchel in the back office. Walk in, take it, and run for the docks. The police will not be far behind — that is the job."',
    objective: 'Grab the satchel at the bank, then reach the docks (x > 3205)',
    target: { type: 'grab-then-reach', x: BANK.x, y: BANK.y, r: BANK.r, x2: DOCKS_X, stage: 0 },
    reward: 800,
    timeLimit: 150,
    wantedOnGrab: 2,
  },
  {
    id: 'beach-cleanup',
    title: 'Beach Cleanup',
    brief: 'Mama Rosa: "The Gull gang has been leaning on my beach vendors. Six of them are hanging around the south beach. Go remind them whose sand that is. Fists or louder — your call."',
    objective: 'Deal with 6 Gull gang members on the beach',
    target: { type: 'defeat', count: 6, x: 1800, y: 3300, r: 500 },
    reward: 650,
    timeLimit: 180,
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    brief: 'Mama Rosa: "Last one, mijo. The bank again — bigger satchel this time — then the docks, then you lose the cops and you are free. Do this and your debt is paid. All of it."',
    objective: 'Hit the bank, reach the docks, then lose the police',
    target: { type: 'grab-then-reach-lose', x: BANK.x, y: BANK.y, r: BANK.r, x2: DOCKS_X, stage: 0 },
    reward: 2000,
    timeLimit: 240,
    wantedOnGrab: 3,
  },
];

export class MissionSys {
  constructor() {
    this.index = 0;
    this.active = false;
    this.completed = [];
    this.progress = 0;
    this.timer = 0;
    this.stage = 0;
    this.grabbed = false;
  }

  current() {
    return MISSIONS[this.index] || null;
  }

  isStoryDone() {
    return this.index >= MISSIONS.length;
  }

  start(index, world) {
    const def = MISSIONS[index];
    if (!def) return;
    this.index = index;
    this.active = true;
    this.progress = 0;
    this.stage = 0;
    this.grabbed = false;
    this.timer = def.timeLimit || 0;
    if (def.id === 'beach-cleanup') {
      world.spawnRivals(6, 1800, 3300, 420);
    }
    world.addToast(`New job: ${def.title}`);
    world.audio.missionStart();
  }

  // Where the objective marker on the map should point right now.
  objectivePos(world) {
    const def = this.current();
    if (!def || !this.active) return null;
    const t = def.target;
    if (t.type === 'grab-then-reach' || t.type === 'grab-then-reach-lose') {
      if (this.stage === 0) return { x: t.x, y: t.y };
      return { x: t.x2 + 120, y: 1500 };
    }
    return { x: t.x, y: t.y };
  }

  statusText() {
    const def = this.current();
    if (!def) return 'Story complete — Solmara is yours.';
    if (!this.active) return `Next job: ${def.title} — press Enter to start`;
    const t = def.target;
    let extra = '';
    if (t.type === 'defeat') extra = ` (${this.progress}/${t.count})`;
    if (t.type === 'grab-then-reach' || t.type === 'grab-then-reach-lose') {
      extra = this.stage === 0 ? ' — grab the satchel' : ' — run for the docks!';
    }
    const time = this.timer > 0 ? ` — ${Math.ceil(this.timer)}s` : '';
    return `${def.title}: ${def.objective}${extra}${time}`;
  }

  _complete(world) {
    const def = this.current();
    this.active = false;
    this.completed.push(def.id);
    world.player.cash += def.reward;
    world.audio.missionDone();
    world.addToast(`Job done! +$${def.reward}`);
    this.index += 1;
    // Save AFTER the index moves, so a reload resumes at the next job
    // instead of replaying the one just finished.
    world.saveGame();
    if (this.isStoryDone()) {
      world.winGame();
    } else {
      // Hand the player the next job's briefing right away.
      world.state = 'briefing';
    }
  }

  _fail(world, reason) {
    this.active = false;
    world.audio.missionFail();
    world.addToast(`Job failed: ${reason}`);
  }

  update(dt, world) {
    const def = this.current();
    if (!def || !this.active) return;
    const p = world.player;
    const t = def.target;

    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this._fail(world, 'out of time');
        return;
      }
    }

    const d = Math.hypot(p.x - t.x, p.y - t.y);
    switch (t.type) {
      case 'reach':
        if (d < t.r) this._complete(world);
        break;
      case 'reach-in-car':
        if (!p.onFoot && d < t.r) this._complete(world);
        break;
      case 'grab-then-reach':
      case 'grab-then-reach-lose': {
        if (this.stage === 0) {
          if (d < t.r) {
            this.stage = 1;
            this.grabbed = true;
            world.police.setWanted(Math.max(world.police.wanted, def.wantedOnGrab || 2));
            world.addToast('Satchel grabbed! Run for the docks!');
            world.audio.pickup();
          }
        } else if (p.x > t.x2) {
          if (t.type === 'grab-then-reach-lose') {
            if (world.police.wanted === 0) this._complete(world);
          } else {
            this._complete(world);
          }
        }
        break;
      }
      case 'defeat':
        if (this.progress >= t.count) this._complete(world);
        break;
      default:
        break;
    }
  }

  // Called by the world when a rival is taken down.
  onRivalDown(world) {
    const def = this.current();
    if (!def || !this.active) return;
    if (def.target.type === 'defeat') {
      this.progress += 1;
      world.addToast(`Gull down — ${this.progress}/${def.target.count}`);
    }
  }
}
