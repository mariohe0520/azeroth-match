/**
 * storage.js — 持久化存储系统
 * 艾泽拉斯消消乐
 */
'use strict';

const Storage = (() => {
  const SAVE_KEY = 'azerothMatch_v1';

  function defaults() {
    return {
      version: 1,
      tutorialDone: false,
      currentIsland: 0,
      currentLevel: 0,
      highScores: {},
      stars: {},
      totalStars: 0,

      garden: {
        plots: [],
        unlockedSpecies: [],
        seeds: {},
        layout: { rows: 4, cols: 5 }
      },

      potions: {
        inventory: { mana: 0, frost: 0, fire: 0, arcane: 0, shadow: 0 },
        ingredients: { arcane: 0, fel: 0, frost: 0, fire: 0, shadow: 0, nature: 0, holy: 0 }
      },

      daily: {
        lastPlayedDate: null,
        streak: 0,
        bestStreak: 0,
        completedDailies: [],
        weeklyBest: 0
      },

      achievements: {},
      storyProgress: {},

      settings: { soundEnabled: true, theme: 'azeroth' },

      stats: {
        totalMatches: 0, totalGems: 0, totalScore: 0, totalMoves: 0,
        maxCombo: 0, timePlayed: 0, levelsCompleted: 0, bossesDefeated: 0
      }
    };
  }

  let _data = null;

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { _data = deepMerge(defaults(), JSON.parse(raw)); }
      else { _data = defaults(); }
    } catch (e) { _data = defaults(); }
    return _data;
  }

  let _saveTimer = null;
  let _lastSaveTime = 0;
  const SAVE_DEBOUNCE_MS = 1000;

  let _saveWarned = false;

  function _doSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(_data));
    } catch (e) {
      if (!_saveWarned) {
        _saveWarned = true;
        console.error('[AzerothMatch] Save failed — localStorage may be full:', e.name);
        try {
          if (_data && _data.daily && _data.daily.completedDailies && _data.daily.completedDailies.length > 60) {
            _data.daily.completedDailies = _data.daily.completedDailies.slice(-30);
            localStorage.setItem(SAVE_KEY, JSON.stringify(_data));
          }
        } catch (e2) {}
      }
    }
  }

  function save() {
    if (!_data) return;
    const now = Date.now();
    if (now - _lastSaveTime >= SAVE_DEBOUNCE_MS) {
      _lastSaveTime = now;
      _doSave();
    } else {
      if (!_saveTimer) {
        _saveTimer = setTimeout(() => {
          _saveTimer = null;
          _lastSaveTime = Date.now();
          _doSave();
        }, SAVE_DEBOUNCE_MS - (now - _lastSaveTime));
      }
    }
  }

  function get() { if (!_data) load(); return _data; }
  function reset() { _data = defaults(); save(); return _data; }

  function migrateV1() {
    // Migrate from mango-match saves if present
    try {
      const old = JSON.parse(localStorage.getItem('mangoMatch_v2'));
      if (old && !localStorage.getItem(SAVE_KEY)) {
        const d = defaults();
        d.tutorialDone = true;
        // Don't migrate levels - fresh start for new game
        _data = d;
        save();
      }
    } catch (e) {}
  }

  function deepMerge(source, target) {
    const result = { ...source };
    for (const key in target) {
      if (target[key] !== null && typeof target[key] === 'object' && !Array.isArray(target[key])
          && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(source[key], target[key]);
      } else {
        result[key] = target[key];
      }
    }
    return result;
  }

  // Flush any pending save when the page unloads
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (_data && _saveTimer) {
        clearTimeout(_saveTimer);
        _saveTimer = null;
        _doSave();
      }
    });
    // Also save on visibility change (tab switch on mobile)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && _data) {
        if (_saveTimer) {
          clearTimeout(_saveTimer);
          _saveTimer = null;
        }
        _doSave();
      }
    });
  }

  return { load, save, get, reset, migrateV1, defaults };
})();
