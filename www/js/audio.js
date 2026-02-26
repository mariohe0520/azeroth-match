/**
 * audio.js — 音效系统
 * 艾泽拉斯消消乐 — 魔幻风音效
 */
'use strict';

const Audio = (() => {
  const ACx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  let enabled = true;
  let bgMusicRunning = false;
  let bgMusicScheduled = [];
  let bgMusicGain = null;

  const GEM_FREQS = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];
  const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];

  function init() {
    if (!audioCtx) {
      try { audioCtx = new ACx(); if (audioCtx.state === 'suspended') audioCtx.resume(); }
      catch (e) {}
    } else if (audioCtx.state === 'suspended') { audioCtx.resume(); }
  }

  function setEnabled(v) { enabled = v; if (!v) stopBgMusic(); }
  function isEnabled() { return enabled; }

  function playTone(freq, dur, type, vol, delay) {
    if (!enabled || !audioCtx) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = freq; o.type = type || 'sine';
      const t0 = audioCtx.currentTime + (delay || 0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol || 0.25, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.01, t0 + dur);
      o.start(t0); o.stop(t0 + dur + 0.01);
    } catch (e) {}
  }

  function playChord(freqs, dur, type, vol, delay) {
    freqs.forEach(f => playTone(f, dur, type, vol, delay));
  }

  function playMatchGem(gemType) {
    if (!enabled || !audioCtx) return;
    const freq = GEM_FREQS[Math.min(gemType, GEM_FREQS.length - 1)];
    playTone(freq, 0.18, 'sine', 0.28);
    playTone(freq * 2, 0.1, 'sine', 0.08, 0.04);
  }

  function playMatch(gemType) {
    if (gemType !== undefined) playMatchGem(gemType);
    else { playTone(523, 0.1, 'sine', 0.25); playTone(659, 0.1, 'sine', 0.22); playTone(784, 0.12, 'sine', 0.2); }
  }

  function playCombo(n) {
    if (!enabled || !audioCtx) return;
    const baseIdx = Math.min(n - 1, PENTATONIC.length - 1);
    playTone(PENTATONIC[baseIdx], 0.12, 'triangle', 0.22);
    playTone(PENTATONIC[Math.min(baseIdx + 1, PENTATONIC.length - 1)], 0.12, 'triangle', 0.22, 0.08);
    playTone(PENTATONIC[Math.min(baseIdx + 2, PENTATONIC.length - 1)], 0.18, 'triangle', 0.28, 0.16);
    if (n >= 4) playTone(PENTATONIC[Math.min(baseIdx + 2, PENTATONIC.length - 1)] * 1.5, 0.25, 'sine', 0.15, 0.2);
    if (n >= 6) PENTATONIC.forEach((f, i) => playTone(f * 2, 0.2, 'sine', 0.1, i * 0.06));
  }

  function playLevelUp() {
    if (!enabled || !audioCtx) return;
    [261.63, 329.63, 392.00, 523.25, 659.25, 784.00].forEach((f, i) => playTone(f, 0.22, 'sine', 0.3, i * 0.1));
    setTimeout(() => playChord([523.25, 659.25, 784.00], 0.5, 'sine', 0.22), 700);
  }

  function playFail() {
    if (!enabled || !audioCtx) return;
    [392.00, 329.63, 261.63, 220.00, 174.61].forEach((f, i) => playTone(f, 0.3, 'sawtooth', 0.15, i * 0.12));
  }

  function playSwap() { playTone(440, 0.07, 'sine', 0.12); }
  function playInvalid() { playTone(220, 0.08, 'square', 0.1); playTone(180, 0.12, 'square', 0.08, 0.06); }
  function playSelect() { playTone(660, 0.05, 'sine', 0.1); }
  function playPlant() { [440, 554, 659].forEach((f, i) => playTone(f, 0.15, 'sine', 0.2, i * 0.08)); }
  function playHarvest() { [659, 784, 880, 1047].forEach((f, i) => playTone(f, 0.18, 'sine', 0.25, i * 0.07)); }
  function playCraft() { [330, 440, 660].forEach((f, i) => playTone(f, 0.15, 'triangle', 0.2, i * 0.08)); }

  function playAchievement() {
    if (!enabled || !audioCtx) return;
    playTone(523.25, 0.12, 'sine', 0.22);
    playTone(659.25, 0.12, 'sine', 0.22, 0.1);
    playTone(784.00, 0.2, 'sine', 0.28, 0.2);
    playTone(1047.0, 0.3, 'sine', 0.18, 0.3);
  }

  // ======== Background Music ========
  // Ethereal ambient loop using pentatonic scale

  function startBgMusic() {
    if (!enabled || !audioCtx || bgMusicRunning) return;
    bgMusicRunning = true;
    bgMusicGain = audioCtx.createGain();
    bgMusicGain.connect(audioCtx.destination);
    bgMusicGain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    scheduleBgLoop();
  }

  function stopBgMusic() {
    bgMusicRunning = false;
    bgMusicScheduled.forEach(node => {
      try { node.stop(); } catch (e) {}
    });
    bgMusicScheduled = [];
    if (bgMusicGain) {
      try { bgMusicGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.5); } catch (e) {}
      bgMusicGain = null;
    }
  }

  function scheduleBgLoop() {
    if (!bgMusicRunning || !audioCtx || !bgMusicGain) return;

    const notes = [261.63, 329.63, 392.00, 440.00, 523.25, 392.00, 329.63, 293.66];
    const now = audioCtx.currentTime;
    const noteDur = 0.8;

    notes.forEach((freq, i) => {
      scheduleNote(freq, now + i * noteDur, noteDur * 0.9, 'sine');
      if (i % 2 === 0) {
        scheduleNote(freq * 0.5, now + i * noteDur, noteDur * 1.5, 'triangle');
      }
    });

    const loopDur = notes.length * noteDur;
    setTimeout(() => { if (bgMusicRunning) scheduleBgLoop(); }, loopDur * 1000 - 200);
  }

  function scheduleNote(freq, startTime, dur, type) {
    if (!audioCtx || !bgMusicGain) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(bgMusicGain);
      o.frequency.value = freq;
      o.type = type || 'sine';
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
      o.start(startTime);
      o.stop(startTime + dur + 0.01);
      bgMusicScheduled.push(o);
      o.onended = () => {
        const idx = bgMusicScheduled.indexOf(o);
        if (idx !== -1) bgMusicScheduled.splice(idx, 1);
      };
    } catch (e) {}
  }

  return {
    init, setEnabled, isEnabled,
    playTone, playChord,
    playMatch, playMatchGem, playCombo,
    playLevelUp, playFail,
    playSwap, playInvalid, playSelect,
    playPlant, playHarvest, playCraft,
    playAchievement,
    startBgMusic, stopBgMusic
  };
})();
