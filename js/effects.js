/**
 * effects.js -- Premium Juice & Feedback System
 * Particle trails, explosion bursts, screen shake, glow effects,
 * board bounce, rage meter, charged gems, ice blocks, boss attacks,
 * achievement popups, haptic feedback, escalating sounds
 */
'use strict';

const Effects = (() => {
  // ======== PARTICLE TRAIL SYSTEM ========
  let swapTrails = [];
  const MAX_TRAIL_PARTICLES = 60;

  function spawnSwapTrail(x1, y1, x2, y2, gemType) {
    const g = Gems.TYPES[gemType] || Gems.TYPES[0];
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      swapTrails.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 8,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 8,
        r: 2 + Math.random() * 2.5,
        color: Math.random() > 0.5 ? g.c1 : g.glow,
        alpha: 0.8,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30 - 15,
        shrink: 0.97
      });
    }
    if (swapTrails.length > MAX_TRAIL_PARTICLES) {
      swapTrails.splice(0, swapTrails.length - MAX_TRAIL_PARTICLES);
    }
  }

  function updateTrails(dt) {
    for (let i = swapTrails.length - 1; i >= 0; i--) {
      const p = swapTrails[i];
      p.life += dt;
      if (p.life >= p.maxLife) { swapTrails.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r *= p.shrink;
      p.alpha = 1 - (p.life / p.maxLife);
    }
  }

  function renderTrails(ctx) {
    swapTrails.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.7;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ======== EXPLOSION BURST SYSTEM ========
  let explosionBursts = [];
  const MAX_BURST_PARTICLES = 120;

  function spawnExplosion(cx, cy, gemType, intensity) {
    const g = Gems.TYPES[gemType] || Gems.TYPES[0];
    const count = Math.min(intensity || 12, MAX_BURST_PARTICLES - explosionBursts.length);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 100 + Math.random() * 200;
      const isRing = i < count / 2;
      explosionBursts.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed * (isRing ? 1.4 : 0.8),
        vy: Math.sin(angle) * speed * (isRing ? 1.4 : 0.8),
        r: isRing ? (1.5 + Math.random() * 2) : (2.5 + Math.random() * 3),
        color: isRing ? '#FFFFFF' : (Math.random() > 0.3 ? g.c1 : g.glow),
        alpha: 1,
        life: 0,
        maxLife: isRing ? (0.2 + Math.random() * 0.15) : (0.35 + Math.random() * 0.35),
        gravity: 200 + Math.random() * 200,
        type: Math.random() > 0.5 ? 'star' : 'circle',
        shrink: 0.98
      });
    }
    // Spawn ring shockwave
    explosionBursts.push({
      x: cx, y: cy, vx: 0, vy: 0,
      r: 3, color: g.glow, alpha: 0.6,
      life: 0, maxLife: 0.35, gravity: 0,
      type: 'ring', ringRadius: 0, ringSpeed: 250,
      shrink: 1
    });
  }

  function updateExplosions(dt) {
    for (let i = explosionBursts.length - 1; i >= 0; i--) {
      const p = explosionBursts[i];
      p.life += dt;
      if (p.life >= p.maxLife) { explosionBursts.splice(i, 1); continue; }
      if (p.type === 'ring') {
        p.ringRadius += p.ringSpeed * dt;
        p.alpha = 0.6 * (1 - p.life / p.maxLife);
      } else {
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r *= p.shrink;
        p.alpha = 1 - (p.life / p.maxLife);
      }
    }
  }

  function renderExplosions(ctx) {
    explosionBursts.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * (1 - p.life / p.maxLife);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 3;
        _drawStar(ctx, p.x, p.y, p.r);
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function _drawStar(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 2 * i / 5 - Math.PI / 2;
      const a2 = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a2) * r * 0.4, y + Math.sin(a2) * r * 0.4);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ======== CHAIN COUNTER SYSTEM ========
  let chainTexts = [];

  function spawnChainText(x, y, combo) {
    let text, color, size;
    if (combo >= 10) {
      text = `LEGENDARY x${combo}!!!`;
      color = '#FFD700';
      size = 2.8;
    } else if (combo >= 8) {
      text = `ULTRA x${combo}!!`;
      color = '#FF00FF';
      size = 2.4;
    } else if (combo >= 5) {
      text = `MEGA x${combo}!`;
      color = '#FF4500';
      size = 2.0;
    } else if (combo >= 3) {
      text = `COMBO x${combo}`;
      color = '#FF8C00';
      size = 1.5;
    } else {
      text = `${combo}x`;
      color = '#FFD700';
      size = 1.2;
    }
    chainTexts.push({
      x, y: y - 10, text, color,
      alpha: 0, life: 0, maxLife: 1.2,
      scale: 0.1, targetScale: size,
      vy: -40 - combo * 5,
      rotation: (Math.random() - 0.5) * 0.2,
      sizeScale: size
    });
  }

  function updateChainTexts(dt) {
    for (let i = chainTexts.length - 1; i >= 0; i--) {
      const f = chainTexts[i];
      f.life += dt;
      if (f.life >= f.maxLife) { chainTexts.splice(i, 1); continue; }
      const t = f.life / f.maxLife;
      f.y += f.vy * dt;
      f.vy *= 0.97;
      // Pop in, hold, fade out
      if (t < 0.15) {
        f.alpha = t / 0.15;
        f.scale += (f.targetScale * 1.3 - f.scale) * 0.25;
      } else if (t < 0.3) {
        f.alpha = 1;
        f.scale += (f.targetScale - f.scale) * 0.2;
      } else if (t > 0.7) {
        f.alpha = 1 - (t - 0.7) / 0.3;
        f.scale *= 0.995;
      } else {
        f.alpha = 1;
      }
    }
  }

  function renderChainTexts(ctx) {
    chainTexts.forEach(f => {
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      const fontSize = Math.round(16 * f.scale);
      ctx.font = `900 ${fontSize}px 'Segoe UI',system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Black outline for readability
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = Math.max(2, fontSize * 0.12);
      ctx.lineJoin = 'round';
      ctx.strokeText(f.text, 0, 0);
      // Gradient fill
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      // White inner glow
      if (f.sizeScale >= 2.0) {
        ctx.globalAlpha = f.alpha * 0.3;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(f.text, 0, 0);
      }
      ctx.restore();
    });
  }

  // ======== GLOW EFFECT ON SELECTED GEM ========
  let glowPulse = 0;

  function renderSelectionGlow(ctx, x, y, cellSize, timestamp) {
    glowPulse = 0.5 + 0.5 * Math.sin((timestamp || 0) * 0.006);
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    const glowR = cellSize * 0.55 + glowPulse * 4;

    ctx.save();
    // Outer golden aura
    const grad = ctx.createRadialGradient(cx, cy, cellSize * 0.3, cx, cy, glowR);
    grad.addColorStop(0, `rgba(255,215,0,${0.15 + glowPulse * 0.1})`);
    grad.addColorStop(0.5, `rgba(255,180,0,${0.08 + glowPulse * 0.05})`);
    grad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Spinning light particles around selected gem
    for (let i = 0; i < 4; i++) {
      const angle = (timestamp || 0) * 0.003 + (Math.PI * 2 * i) / 4;
      const px = cx + Math.cos(angle) * (cellSize * 0.42);
      const py = cy + Math.sin(angle) * (cellSize * 0.42);
      ctx.globalAlpha = 0.5 + glowPulse * 0.3;
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ======== BOARD BOUNCE ON GEM LANDING ========
  let boardBounce = 0;
  let boardBounceVelocity = 0;
  const BOUNCE_SPRING = 300;
  const BOUNCE_DAMPING = 8;

  function triggerBoardBounce(intensity) {
    boardBounceVelocity = -(intensity || 4) * 60;
  }

  function updateBoardBounce(dt) {
    if (Math.abs(boardBounce) < 0.1 && Math.abs(boardBounceVelocity) < 0.5) {
      boardBounce = 0;
      boardBounceVelocity = 0;
      return;
    }
    boardBounceVelocity += -boardBounce * BOUNCE_SPRING * dt;
    boardBounceVelocity *= Math.pow(0.001, dt * BOUNCE_DAMPING);
    boardBounce += boardBounceVelocity * dt;
  }

  function getBoardBounceOffset() {
    return boardBounce;
  }

  // ======== INDIVIDUAL GEM SCORE FLOATS ========
  let gemScoreFloats = [];

  function spawnGemScore(x, y, points, gemType) {
    const g = Gems.TYPES[gemType] || Gems.TYPES[0];
    gemScoreFloats.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y,
      text: `+${points}`,
      color: g.glow || '#FFD700',
      alpha: 0, life: 0, maxLife: 0.8,
      vy: -60 - Math.random() * 20,
      scale: 0.5
    });
  }

  function updateGemScores(dt) {
    for (let i = gemScoreFloats.length - 1; i >= 0; i--) {
      const f = gemScoreFloats[i];
      f.life += dt;
      if (f.life >= f.maxLife) { gemScoreFloats.splice(i, 1); continue; }
      const t = f.life / f.maxLife;
      f.y += f.vy * dt;
      f.vy *= 0.97;
      if (t < 0.15) {
        f.alpha = t / 0.15;
        f.scale = 0.5 + (1.0 - 0.5) * (t / 0.15);
      } else if (t > 0.6) {
        f.alpha = 1 - (t - 0.6) / 0.4;
      } else {
        f.alpha = 1;
        f.scale = 1;
      }
    }
  }

  function renderGemScores(ctx) {
    gemScoreFloats.forEach(f => {
      ctx.save();
      ctx.globalAlpha = f.alpha;
      const fontSize = Math.round(12 * f.scale);
      ctx.font = `bold ${fontSize}px 'Segoe UI',system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
  }

  // ======== MULTIPLIER STACK DISPLAY ========
  let multiplierDisplay = { value: 0, alpha: 0, scale: 1, y: 0 };

  function showMultiplier(combo, x, y) {
    if (combo < 2) return;
    multiplierDisplay = {
      value: combo,
      alpha: 1,
      scale: 0.3,
      targetScale: 1.2 + combo * 0.15,
      x: x,
      y: y - 25,
      life: 0,
      maxLife: 1.0
    };
  }

  function updateMultiplier(dt) {
    if (multiplierDisplay.alpha <= 0) return;
    multiplierDisplay.life += dt;
    const t = multiplierDisplay.life / multiplierDisplay.maxLife;
    if (t < 0.2) {
      multiplierDisplay.scale += (multiplierDisplay.targetScale - multiplierDisplay.scale) * 0.2;
      multiplierDisplay.alpha = t / 0.2;
    } else if (t > 0.6) {
      multiplierDisplay.alpha = 1 - (t - 0.6) / 0.4;
    }
    multiplierDisplay.y -= 25 * dt;
    if (t >= 1) multiplierDisplay.alpha = 0;
  }

  function renderMultiplier(ctx) {
    if (multiplierDisplay.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = multiplierDisplay.alpha;
    const fontSize = Math.round(22 * multiplierDisplay.scale);
    ctx.font = `900 ${fontSize}px 'Segoe UI',system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = `x${multiplierDisplay.value}!`;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, multiplierDisplay.x, multiplierDisplay.y);
    // Color gradient based on combo
    const v = multiplierDisplay.value;
    const color = v >= 6 ? '#FF00FF' : v >= 4 ? '#FF4500' : v >= 3 ? '#FF8C00' : '#FFD700';
    ctx.fillStyle = color;
    ctx.fillText(text, multiplierDisplay.x, multiplierDisplay.y);
    ctx.restore();
  }

  // ======== PERFECT MOVE DETECTION ========
  let perfectMoveFlash = { alpha: 0, life: 0 };

  function triggerPerfectMove() {
    perfectMoveFlash = { alpha: 1, life: 0, maxLife: 1.5 };
  }

  function updatePerfectFlash(dt) {
    if (perfectMoveFlash.alpha <= 0) return;
    perfectMoveFlash.life += dt;
    const t = perfectMoveFlash.life / perfectMoveFlash.maxLife;
    if (t >= 1) { perfectMoveFlash.alpha = 0; return; }
    perfectMoveFlash.alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
  }

  function renderPerfectFlash(ctx, w, h) {
    if (perfectMoveFlash.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = perfectMoveFlash.alpha * 0.3;
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
    grad.addColorStop(0, 'rgba(255,215,0,0.4)');
    grad.addColorStop(0.5, 'rgba(255,180,0,0.1)');
    grad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // "PERFECT!" text
    if (perfectMoveFlash.life < 0.8) {
      ctx.globalAlpha = perfectMoveFlash.alpha;
      const pScale = perfectMoveFlash.life < 0.15 ? perfectMoveFlash.life / 0.15 * 1.3 : 1.0;
      const fs = Math.round(28 * pScale);
      ctx.font = `900 ${fs}px 'Segoe UI',system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText('PERFECT!', w / 2, h * 0.3);
      ctx.fillStyle = '#FFD700';
      ctx.fillText('PERFECT!', w / 2, h * 0.3);
    }
    ctx.restore();
  }

  // ======== RAGE METER ========
  let rageMeter = 0;
  const RAGE_MAX = 100;
  let rageReady = false;
  let rageActive = false;
  let ragePulse = 0;

  function addRage(amount) {
    if (rageActive) return;
    rageMeter = Math.min(RAGE_MAX, rageMeter + amount);
    if (rageMeter >= RAGE_MAX && !rageReady) {
      rageReady = true;
    }
  }

  function isRageReady() { return rageReady && !rageActive; }
  function getRagePct() { return rageMeter / RAGE_MAX; }

  function activateRage() {
    if (!rageReady) return false;
    rageActive = true;
    rageReady = false;
    return true;
  }

  function consumeRage() {
    rageActive = false;
    rageMeter = 0;
  }

  function isRageActive() { return rageActive; }

  function resetRage() {
    rageMeter = 0;
    rageReady = false;
    rageActive = false;
  }

  function updateRageMeter(dt, timestamp) {
    ragePulse = 0.5 + 0.5 * Math.sin((timestamp || 0) * 0.005);
  }

  function renderRageMeter(ctx, x, y, w, h, timestamp) {
    const pct = rageMeter / RAGE_MAX;
    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, 4) : ctx.rect(x, y, w, h);
    ctx.fill();

    // Fill
    if (pct > 0) {
      const fillW = w * pct;
      const grad = ctx.createLinearGradient(x, 0, x + fillW, 0);
      if (rageReady) {
        grad.addColorStop(0, '#FF4400');
        grad.addColorStop(0.5, '#FF8800');
        grad.addColorStop(1, '#FFAA00');
      } else {
        grad.addColorStop(0, '#882200');
        grad.addColorStop(1, '#CC4400');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, fillW, h, 4) : ctx.rect(x, y, fillW, h);
      ctx.fill();
    }

    // Ready glow
    if (rageReady) {
      ctx.globalAlpha = 0.3 + ragePulse * 0.3;
      ctx.strokeStyle = '#FF6600';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#FF4400';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - 1, y - 1, w + 2, h + 2, 5) : ctx.rect(x - 1, y - 1, w + 2, h + 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Label
    ctx.globalAlpha = 1;
    ctx.fillStyle = rageReady ? '#FFD700' : '#AAA';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rageReady ? 'RAGE READY!' : 'RAGE', x + w / 2, y + h / 2);

    ctx.restore();
  }

  // ======== CHARGED GEMS ========
  let chargedGems = {}; // "row,col" -> { charges: N, maxCharges: 3 }

  function addCharge(row, col) {
    const key = `${row},${col}`;
    if (!chargedGems[key]) {
      chargedGems[key] = { charges: 1, maxCharges: 3 };
    } else {
      chargedGems[key].charges = Math.min(chargedGems[key].maxCharges, chargedGems[key].charges + 1);
    }
    return chargedGems[key].charges >= chargedGems[key].maxCharges;
  }

  function getCharge(row, col) {
    return chargedGems[`${row},${col}`] || null;
  }

  function removeCharge(row, col) {
    delete chargedGems[`${row},${col}`];
  }

  function clearAllCharges() {
    chargedGems = {};
  }

  function renderChargedGem(ctx, x, y, cellSize, charges, timestamp) {
    if (charges <= 0) return;
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    const pulse = 0.5 + 0.5 * Math.sin((timestamp || 0) * 0.006);

    ctx.save();
    // Charge rings
    for (let i = 0; i < charges; i++) {
      const ringR = cellSize * 0.35 + i * 4;
      ctx.globalAlpha = (0.2 + pulse * 0.15) * (charges / 3);
      ctx.strokeStyle = charges >= 3 ? '#FF4400' : charges >= 2 ? '#FF8800' : '#FFAA44';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Charge indicator dots
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < charges; i++) {
      const a = (Math.PI * 2 * i) / 3 + (timestamp || 0) * 0.002;
      const px = cx + Math.cos(a) * (cellSize * 0.32);
      const py = cy + Math.sin(a) * (cellSize * 0.32);
      ctx.fillStyle = charges >= 3 ? '#FF4400' : '#FFAA44';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ======== GEM TRANSFORMATION EFFECT ========
  let transformEffects = [];

  function spawnTransformEffect(x, y, cellSize, gemType) {
    const g = Gems.TYPES[gemType] || Gems.TYPES[0];
    transformEffects.push({
      cx: x + cellSize / 2,
      cy: y + cellSize / 2,
      r: cellSize * 0.4,
      color: g.glow,
      alpha: 0.8,
      life: 0,
      maxLife: 0.5,
      rotation: 0
    });
  }

  function updateTransforms(dt) {
    for (let i = transformEffects.length - 1; i >= 0; i--) {
      const e = transformEffects[i];
      e.life += dt;
      if (e.life >= e.maxLife) { transformEffects.splice(i, 1); continue; }
      const t = e.life / e.maxLife;
      e.alpha = (1 - t) * 0.8;
      e.r += 80 * dt;
      e.rotation += 8 * dt;
    }
  }

  function renderTransforms(ctx) {
    transformEffects.forEach(e => {
      ctx.save();
      ctx.globalAlpha = e.alpha;
      ctx.translate(e.cx, e.cy);
      ctx.rotate(e.rotation);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 6;
      // Spinning diamond shape
      const r = e.r;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.7, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.7, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });
  }

  // ======== BOSS ATTACK SYSTEM ========
  let bossAttackEffect = { active: false, life: 0, maxLife: 0, type: '', text: '' };

  function triggerBossAttack(attackName, reduceMoves, reduceScore) {
    bossAttackEffect = {
      active: true,
      life: 0,
      maxLife: 1.5,
      type: 'attack',
      text: attackName || 'Boss Attack!',
      reduceMoves: reduceMoves || 0,
      reduceScore: reduceScore || 0,
      shakeIntensity: 12
    };
    return bossAttackEffect;
  }

  function updateBossAttack(dt) {
    if (!bossAttackEffect.active) return;
    bossAttackEffect.life += dt;
    if (bossAttackEffect.life >= bossAttackEffect.maxLife) {
      bossAttackEffect.active = false;
    }
  }

  function renderBossAttack(ctx, w, h) {
    if (!bossAttackEffect.active) return;
    const t = bossAttackEffect.life / bossAttackEffect.maxLife;
    ctx.save();
    // Red flash
    if (t < 0.3) {
      ctx.globalAlpha = (1 - t / 0.3) * 0.25;
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, w, h);
    }
    // Attack text
    if (t < 0.8) {
      const tAlpha = t < 0.15 ? t / 0.15 : t > 0.6 ? 1 - (t - 0.6) / 0.2 : 1;
      ctx.globalAlpha = tAlpha;
      const scale = t < 0.1 ? t / 0.1 * 1.2 : 1.0;
      const fs = Math.round(20 * scale);
      ctx.font = `900 ${fs}px 'Segoe UI',system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(bossAttackEffect.text, w / 2, h * 0.35);
      ctx.fillStyle = '#FF4444';
      ctx.fillText(bossAttackEffect.text, w / 2, h * 0.35);
      // Penalty text
      if (bossAttackEffect.reduceMoves > 0) {
        ctx.font = `bold 14px sans-serif`;
        ctx.fillStyle = '#FF8888';
        ctx.fillText(`-${bossAttackEffect.reduceMoves} moves!`, w / 2, h * 0.35 + 28);
      }
      if (bossAttackEffect.reduceScore > 0) {
        ctx.font = `bold 14px sans-serif`;
        ctx.fillStyle = '#FF8888';
        ctx.fillText(`-${bossAttackEffect.reduceScore} score!`, w / 2, h * 0.35 + 44);
      }
    }
    ctx.restore();
  }

  // ======== BOSS HP BAR WITH PHASES ========
  function renderBossHpBar(ctx, w, bossHp, bossMaxHp, timestamp) {
    if (bossMaxHp <= 0) return;
    const barW = w - 20;
    const barH = 16;
    const x = 10, y = 4;
    const pct = bossHp / bossMaxHp;

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, barW, barH, 8) : ctx.rect(x, y, barW, barH);
    ctx.fill();

    // Phase-based color
    let color1, color2;
    if (pct > 0.66) {
      color1 = '#44FF44'; color2 = '#22CC22'; // Phase 1: Green
    } else if (pct > 0.33) {
      color1 = '#FFCC00'; color2 = '#FF8800'; // Phase 2: Yellow/Orange
    } else {
      color1 = '#FF4444'; color2 = '#CC0000'; // Phase 3: Red (enraged)
    }

    // HP fill
    if (pct > 0) {
      const fillW = barW * pct;
      const hpGrad = ctx.createLinearGradient(x, 0, x + fillW, 0);
      hpGrad.addColorStop(0, color1);
      hpGrad.addColorStop(1, color2);
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, fillW, barH, 8) : ctx.rect(x, y, fillW, barH);
      ctx.fill();

      // Enraged pulse in phase 3
      if (pct <= 0.33) {
        const pulse = 0.5 + 0.5 * Math.sin((timestamp || 0) * 0.008);
        ctx.globalAlpha = pulse * 0.3;
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, fillW, barH, 8) : ctx.rect(x, y, fillW, barH);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Shine overlay
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, fillW, barH / 2, [8, 8, 0, 0]) : ctx.rect(x, y, fillW, barH / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Phase markers
    const marker1 = x + barW * 0.66;
    const marker2 = x + barW * 0.33;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marker1, y); ctx.lineTo(marker1, y + barH);
    ctx.moveTo(marker2, y); ctx.lineTo(marker2, y + barH);
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, barW, barH, 8) : ctx.rect(x, y, barW, barH);
    ctx.stroke();

    // HP text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 2;
    const phaseText = pct <= 0.33 ? ' [ENRAGED]' : pct <= 0.66 ? ' [PHASE 2]' : '';
    ctx.fillText(`BOSS: ${bossHp}/${bossMaxHp}${phaseText}`, w / 2, y + barH / 2);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  // ======== TOTAL MOVE SCORE REVEAL ========
  let moveScoreReveal = { active: false, score: 0, life: 0 };

  function showMoveScore(score, x, y) {
    moveScoreReveal = {
      active: true,
      score: score,
      x: x,
      y: y - 20,
      life: 0,
      maxLife: 1.2,
      alpha: 0,
      scale: 0.3
    };
  }

  function updateMoveScore(dt) {
    if (!moveScoreReveal.active) return;
    moveScoreReveal.life += dt;
    const t = moveScoreReveal.life / moveScoreReveal.maxLife;
    if (t >= 1) { moveScoreReveal.active = false; return; }
    moveScoreReveal.y -= 30 * dt;
    if (t < 0.2) {
      moveScoreReveal.alpha = t / 0.2;
      moveScoreReveal.scale = 0.3 + (1.4 - 0.3) * (t / 0.2);
    } else if (t < 0.35) {
      moveScoreReveal.scale += (1.0 - moveScoreReveal.scale) * 0.15;
      moveScoreReveal.alpha = 1;
    } else if (t > 0.7) {
      moveScoreReveal.alpha = 1 - (t - 0.7) / 0.3;
    }
  }

  function renderMoveScore(ctx) {
    if (!moveScoreReveal.active) return;
    ctx.save();
    ctx.globalAlpha = moveScoreReveal.alpha;
    const fs = Math.round(20 * moveScoreReveal.scale);
    ctx.font = `900 ${fs}px 'Segoe UI',system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    const text = `+${moveScoreReveal.score}`;
    ctx.strokeText(text, moveScoreReveal.x, moveScoreReveal.y);
    ctx.fillStyle = '#FFD700';
    ctx.fillText(text, moveScoreReveal.x, moveScoreReveal.y);
    ctx.restore();
  }

  // ======== HAPTIC FEEDBACK ========
  function hapticLight() {
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
  }

  function hapticMedium() {
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) {}
  }

  function hapticHeavy() {
    try { if (navigator.vibrate) navigator.vibrate([30, 10, 50]); } catch (e) {}
  }

  function hapticCombo(combo) {
    try {
      if (!navigator.vibrate) return;
      if (combo >= 5) navigator.vibrate([40, 20, 60, 20, 80]);
      else if (combo >= 3) navigator.vibrate([30, 15, 40]);
      else navigator.vibrate(20);
    } catch (e) {}
  }

  // ======== MASTER UPDATE & RENDER ========
  function updateAll(dt, timestamp) {
    updateTrails(dt);
    updateExplosions(dt);
    updateChainTexts(dt);
    updateBoardBounce(dt);
    updateGemScores(dt);
    updateMultiplier(dt);
    updatePerfectFlash(dt);
    updateRageMeter(dt, timestamp);
    updateTransforms(dt);
    updateBossAttack(dt);
    updateMoveScore(dt);
  }

  function renderAll(ctx, w, h, timestamp) {
    renderTrails(ctx);
    renderExplosions(ctx);
    renderGemScores(ctx);
    renderChainTexts(ctx);
    renderMultiplier(ctx);
    renderTransforms(ctx);
    renderPerfectFlash(ctx, w, h);
    renderMoveScore(ctx);
  }

  function resetAll() {
    swapTrails = [];
    explosionBursts = [];
    chainTexts = [];
    gemScoreFloats = [];
    transformEffects = [];
    boardBounce = 0;
    boardBounceVelocity = 0;
    multiplierDisplay = { value: 0, alpha: 0, scale: 1, y: 0 };
    perfectMoveFlash = { alpha: 0, life: 0 };
    resetRage();
    clearAllCharges();
    bossAttackEffect = { active: false };
    moveScoreReveal = { active: false };
  }

  return {
    // Trails
    spawnSwapTrail,
    // Explosions
    spawnExplosion,
    // Chain text
    spawnChainText,
    // Glow
    renderSelectionGlow,
    // Board bounce
    triggerBoardBounce, getBoardBounceOffset,
    // Gem scores
    spawnGemScore,
    // Multiplier
    showMultiplier,
    // Perfect
    triggerPerfectMove,
    // Rage
    addRage, isRageReady, getRagePct, activateRage, consumeRage, isRageActive, resetRage,
    renderRageMeter,
    // Charged gems
    addCharge, getCharge, removeCharge, clearAllCharges, renderChargedGem,
    // Transform
    spawnTransformEffect,
    // Boss
    triggerBossAttack, renderBossAttack, renderBossHpBar,
    bossAttackEffect: () => bossAttackEffect,
    // Move score
    showMoveScore,
    // Haptic
    hapticLight, hapticMedium, hapticHeavy, hapticCombo,
    // Master
    updateAll, renderAll, resetAll
  };
})();
