// SOLMARA: all sound and music is synthesised live with WebAudio.
// No audio files, no network: oscillators, filtered noise and a small
// step-sequencer bassline written for this game. The context is created on
// the first user gesture (unlock), so browsers never block it.

const MUSIC_BASS = [55, 0, 55, 65.41, 55, 0, 49, 58.27];
const MUSIC_LEAD = [220, 0, 261.63, 0, 329.63, 0, 293.66, 246.94];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
    this.musicOn = true;
    this._step = 0;
    this._nextStepTime = 0;
    this._noiseBuffer = null;
  }

  // Call from any user gesture (key press / click) to start the context.
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.16;
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.9;
        this.sfxGain.connect(this.master);
        // One shared white-noise buffer for gunshots, skids and surf.
        const len = this.ctx.sampleRate;
        this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this._noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
        // Continuous engine drone, gain driven by speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 48;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const engineFilter = this.ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        this.engineOsc.connect(engineFilter);
        engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.sfxGain);
        this.engineOsc.start();
        // Two-tone police siren, gain driven by the police system.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 720;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.sfxGain);
        this.sirenOsc.start();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (err) {
      // Sound is optional: the game must keep playing without it.
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
  }

  setMusic(on) {
    this.musicOn = on;
  }

  _tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (err) { /* ignore */ }
  }

  _noise(dur, vol, filterFreq, when = 0) {
    if (!this.ctx || this.muted || !this._noiseBuffer) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch (err) { /* ignore */ }
  }

  click() {
    this._tone(660, 0.07, 'square', 0.12);
  }

  shoot() {
    this._noise(0.14, 0.5, 2400);
    this._tone(190, 0.1, 'square', 0.22, 0, 60);
  }

  punch() {
    this._noise(0.09, 0.35, 500);
    this._tone(120, 0.09, 'sine', 0.3, 0, 55);
  }

  pickup() {
    this._tone(880, 0.1, 'sine', 0.2);
    this._tone(1318, 0.16, 'sine', 0.2, 0.09);
  }

  coin() {
    this._tone(987, 0.09, 'triangle', 0.22);
    this._tone(1318, 0.2, 'triangle', 0.22, 0.08);
  }

  horn() {
    this._tone(370, 0.28, 'square', 0.14);
    this._tone(466, 0.28, 'square', 0.1);
  }

  crash() {
    this._noise(0.3, 0.45, 800);
  }

  missionStart() {
    const notes = [262, 330, 392, 523];
    notes.forEach((f, i) => this._tone(f, 0.16, 'triangle', 0.22, i * 0.11));
  }

  missionDone() {
    const notes = [523, 659, 784, 1046, 784, 1046];
    notes.forEach((f, i) => this._tone(f, 0.2, 'triangle', 0.24, i * 0.12));
  }

  missionFail() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this._tone(f, 0.24, 'sawtooth', 0.14, i * 0.14));
  }

  busted() {
    this._tone(720, 0.5, 'square', 0.16, 0, 360);
    this._tone(540, 0.5, 'square', 0.16, 0.5, 270);
  }

  // Called every frame: engine pitch follows speed, siren wails while
  // wanted, and the bassline steps forward on its own clock.
  update(dt, opts) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      if (this.engineOsc && this.engineGain) {
        const target = this.muted ? 0 : (opts.driving ? 0.05 + opts.speedNorm * 0.11 : 0);
        this.engineGain.gain.setTargetAtTime(target, t, 0.08);
        this.engineOsc.frequency.setTargetAtTime(46 + opts.speedNorm * 95, t, 0.1);
      }
      if (this.sirenOsc && this.sirenGain) {
        const wailing = opts.wanted > 0 && !this.muted;
        const target = wailing ? 0.05 : 0;
        this.sirenGain.gain.setTargetAtTime(target, t, 0.2);
        if (wailing) {
          const phase = Math.floor(t * 1.6) % 2 === 0 ? 720 : 960;
          this.sirenOsc.frequency.setTargetAtTime(phase, t, 0.05);
        }
      }
      if (this.musicOn && !this.muted) {
        if (this._nextStepTime === 0) this._nextStepTime = t + 0.1;
        while (this._nextStepTime < t + 0.15) {
          const step = this._step % 8;
          const bass = MUSIC_BASS[step];
          const lead = MUSIC_LEAD[step];
          const stepDur = 0.26;
          if (bass) this._musicNote(bass, stepDur, 'triangle', 0.5, this._nextStepTime);
          if (lead && this._step % 2 === 0) {
            this._musicNote(lead, stepDur * 0.9, 'sine', 0.16, this._nextStepTime);
          }
          this._step += 1;
          this._nextStepTime += stepDur;
        }
      } else {
        this._nextStepTime = 0;
      }
    } catch (err) { /* ignore */ }
  }

  _musicNote(freq, dur, type, vol, when) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }
}
