// SOLMARA: keyboard + mouse input with two separate action queues.
//
// The split is deliberate and is the fix for a bug in an earlier prototype:
// gameplay keys (E to enter a car, F to punch, Space / click to shoot) were
// swallowed by the menu layer. Here the two queues never mix:
//   - takeUiActions() is only ever called while a menu screen is showing
//     (title, briefing, pause, game over). It answers Enter, Escape, P, M, R.
//   - takePlayerActions() is only ever called while the game is playing.
//     It answers E, F, Space and mouse clicks.
// Movement keys are held-state, read every frame while playing, and are not
// consumed by either queue.

const UI_KEYS = {
  Enter: 'confirm',
  Escape: 'back',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
};

const PLAYER_KEYS = {
  KeyE: 'interact',
  KeyF: 'punch',
  Space: 'shoot',
  KeyH: 'horn',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = [];
    this.mouse = { x: 0, y: 0, clicked: false };
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.push(e.code);
      // Space scrolls the page in some browsers; the game owns it.
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.down.delete(e.code);
    };
    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    };
    this._onMouseDown = (e) => {
      this._onMouseMove(e);
      this.mouse.clicked = true;
      this.pressed.push('MouseClick');
    };
    this._onBlur = () => {
      this.down.clear();
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
  }

  // Pull every queued UI action out of the press buffer, in order.
  // With keepMouse, a mouse click stays queued: while playing, the click
  // belongs to the player (shoot), not to the menus — eating it here was
  // a real bug in an earlier prototype.
  takeUiActions(keepMouse = false) {
    const out = [];
    const rest = [];
    for (const code of this.pressed) {
      if (code === 'MouseClick') {
        if (keepMouse) rest.push(code);
        else out.push('confirm');
      } else if (UI_KEYS[code]) out.push(UI_KEYS[code]);
      else rest.push(code);
    }
    this.pressed = rest;
    return out;
  }

  // Pull every queued gameplay action out of the press buffer, in order.
  takePlayerActions() {
    const out = [];
    const rest = [];
    for (const code of this.pressed) {
      if (code === 'MouseClick') out.push('shoot');
      else if (PLAYER_KEYS[code]) out.push(PLAYER_KEYS[code]);
      else rest.push(code);
    }
    this.pressed = rest;
    return out;
  }

  // Drop anything still queued (e.g. keys pressed during a screen change).
  clearQueued() {
    this.pressed.length = 0;
    this.mouse.clicked = false;
  }

  // Normalised WASD / arrow movement vector, length 0..1.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) x -= 1;
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) x += 1;
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) y -= 1;
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  isRunning() {
    return this.down.has('ShiftLeft') || this.down.has('ShiftRight');
  }

  isDown(code) {
    return this.down.has(code);
  }
}
