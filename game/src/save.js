// SOLMARA: saving. Progress (cash, mission index, finished jobs) lives in
// localStorage under one key, so closing the tab keeps the story. Loading a
// corrupt or foreign save simply starts fresh — never crash on it.

import { SAVE_KEY } from './config.js';

export class SaveSys {
  constructor() {
    this.key = SAVE_KEY;
  }

  load() {
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return {
        cash: typeof data.cash === 'number' ? data.cash : 0,
        missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
        // De-duplicated: an old save could hold a job twice.
        completed: Array.isArray(data.completed) ? [...new Set(data.completed)] : [],
        bestScore: typeof data.bestScore === 'number' ? data.bestScore : 0,
      };
    } catch (err) {
      return null;
    }
  }

  save(data) {
    try {
      window.localStorage.setItem(this.key, JSON.stringify({
        cash: data.cash || 0,
        missionIndex: data.missionIndex || 0,
        completed: data.completed || [],
        bestScore: data.bestScore || 0,
        savedAt: Date.now(),
      }));
    } catch (err) {
      // Storage full or blocked (private mode): the game still plays.
    }
  }

  clear() {
    try {
      window.localStorage.removeItem(this.key);
    } catch (err) { /* ignore */ }
  }
}
