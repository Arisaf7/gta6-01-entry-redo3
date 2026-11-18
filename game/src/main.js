// SOLMARA — Streets of the Sun: boot, game loop and menu overlays.
// The canvas renders the world and HUD; the menu screens (title, mission
// briefing, pause, game over, story complete) are DOM overlays so their
// text stays crisp. Keyboard and mouse both drive the menus.

import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { applyShotScene, makeShotReady } from './shots.js';
import { GAME_TITLE } from './config.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7);

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');

const audio = new AudioSys();
const input = new Input(canvas);
input.attach();
const world = new World(seed, audio);
const renderer = new Renderer(canvas, world);

const shotMode = applyShotScene(world, params);
const shotReady = shotMode ? makeShotReady(90) : null;

// Exposed for the interactive play-test driver (CDP): state, not secrets.
window.__solmara = { world, input, audio, seed };

function overlayHtml() {
  const m = world.missions.current();
  const saved = world.save.load();
  switch (world.state) {
    case 'title':
      return `
        <div class="panel title-panel">
          <h1>SOLMARA</h1>
          <p class="tagline">Streets of the Sun</p>
          <p class="story">Dario Reyes is back in Solmara — broke, owed, and out of options.
          Mama Rosa has five jobs for him. Steal cars, outrun the police,
          and pay off the debt, one job at a time.</p>
          <p class="save-line">${saved && saved.completed.length ? `Welcome back — ${saved.completed.length} job${saved.completed.length > 1 ? 's' : ''} done, $${saved.cash} in pocket.` : 'A brand-new story. No save found.'}</p>
          <button data-act="start">▶ Start the story</button>
          <p class="controls">WASD move · Shift run · E enter / steal car · F punch · Space or click shoot · P pause · M mute</p>
          <p class="fine">An original game. No real city, no real people, nothing from any other game.</p>
        </div>`;
    case 'briefing':
      return m ? `
        <div class="panel">
          <h2>Job ${world.missions.index + 1} of 5 — ${m.title}</h2>
          <p class="brief">${m.brief}</p>
          <p class="objective">Objective: ${m.objective}</p>
          <p class="reward">Reward: $${m.reward}${m.timeLimit ? ` · Time limit: ${m.timeLimit}s` : ''}</p>
          <button data-act="begin">▶ Begin job</button>
          <p class="controls">Enter to begin · Esc to go back</p>
        </div>` : '';
    case 'pause':
      return `
        <div class="panel">
          <h2>Paused</h2>
          <p class="story">Solmara waits for no one — except right now.</p>
          <button data-act="resume">▶ Resume</button>
          <button data-act="restart">↻ Restart story</button>
          <button data-act="mute">${audio.muted ? '🔊 Unmute' : '🔇 Mute'}</button>
          <p class="controls">Esc / P resume · R restart · M mute</p>
        </div>`;
    case 'gameover':
      return `
        <div class="panel">
          <h2>${world.gameOverReason === 'busted' ? 'BUSTED!' : 'WASTED!'}</h2>
          <p class="story">${world.gameOverReason === 'busted'
            ? 'The Solmara police finally caught up with Dario. Mama Rosa is already working the phones.'
            : 'Dario went down in the streets of Solmara. The city keeps moving without him.'}</p>
          <p class="save-line">Cash kept: $${world.player.cash} · Jobs done: ${world.missions.completed.length} / 5</p>
          <button data-act="start">↻ Try again</button>
          <p class="controls">Enter to retry</p>
        </div>`;
    case 'win':
      return `
        <div class="panel">
          <h2>DEBT PAID. SOLMARA IS YOURS.</h2>
          <p class="story">Five jobs. One clean getaway. Dario Reyes walks out of the docks a free man,
          and Mama Rosa finally smiles. The sun is still shining on Solmara — and now it shines for him.</p>
          <p class="save-line">Final cash: $${world.player.cash} · All 5 jobs complete</p>
          <button data-act="start">↻ Play again</button>
          <p class="controls">Enter to play again</p>
        </div>`;
    default:
      return '';
  }
}

let lastOverlay = '';
function syncOverlay() {
  const html = overlayHtml();
  if (html !== lastOverlay) {
    overlay.innerHTML = html;
    overlay.style.display = html ? 'flex' : 'none';
    lastOverlay = html;
  }
  // The status line is the play-test driver's window into the game.
  const stateText = `${world.state} | cash $${world.player.cash} | hp ${Math.ceil(world.player.health)} | wanted ${world.police.wanted} | mission ${world.missions.index + 1}/5 ${world.missions.active ? '(active)' : ''} | ${world.player.onFoot ? 'on foot' : 'driving'}`;
  if (statusEl.textContent !== stateText) statusEl.textContent = stateText;
  document.title = shotMode && document.title !== 'shot-ready' ? GAME_TITLE : document.title;
}

overlay.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  audio.unlock();
  audio.click();
  const act = btn.dataset.act;
  if (act === 'start') world.startGame();
  else if (act === 'begin') world.beginMission();
  else if (act === 'resume') world.resumeGame();
  else if (act === 'restart') world.startGame();
  else if (act === 'mute') audio.setMuted(!audio.muted);
});

window.addEventListener('resize', () => renderer.resize());

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.update(dt, input);
  input.clearQueued();
  renderer.draw();
  syncOverlay();
  if (shotReady) shotReady();
  requestAnimationFrame(frame);
}

renderer.draw();
syncOverlay();
requestAnimationFrame(frame);
