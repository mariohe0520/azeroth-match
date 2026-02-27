/**
 * gems.js — WoW种族棋子系统
 * 艾泽拉斯消消乐 — 部落 vs 联盟 种族对决
 * Enhanced: Pre-cached emoji rendering, brighter colors, shape fallbacks
 */
'use strict';

const Gems = (() => {
  // 7 WoW race types — 3 Alliance, 3 Horde, 1 Neutral
  // BRIGHT colors so tiles are clearly visible on dark backgrounds
  const TYPES = [
    { id: 'human',    name: '人类骑士',  emoji: '⚔️', symbol: '剑', faction: 'alliance', c1: '#4A8FE7', c2: '#2B5EA7', border: '#7BB8FF', glow: '#5BA0F5', shape: 'diamond' },
    { id: 'orc',      name: '兽人狂战',  emoji: '🪓',  symbol: '斧', faction: 'horde',    c1: '#E84545', c2: '#9B2C2C', border: '#FF7777', glow: '#D45555', shape: 'hexagon' },
    { id: 'nightelf', name: '暗夜精灵',  emoji: '🌙', symbol: '月', faction: 'alliance', c1: '#9B6FC0', c2: '#6B3FA0', border: '#C9A0E8', glow: '#A080D0', shape: 'circle' },
    { id: 'undead',   name: '亡灵术士',  emoji: '💀', symbol: '骷', faction: 'horde',    c1: '#4ACA7B', c2: '#2E8A5B', border: '#70EEA0', glow: '#3EBA6B', shape: 'triangle' },
    { id: 'tauren',   name: '牛头人',    emoji: '🦬', symbol: '牛', faction: 'horde',    c1: '#D4A050', c2: '#A67C2E', border: '#F0C878', glow: '#C4903C', shape: 'square' },
    { id: 'dwarf',    name: '矮人铁匠',  emoji: '🔨', symbol: '锤', faction: 'alliance', c1: '#6AA0C0', c2: '#4A7A9A', border: '#90C0E0', glow: '#7AB0D0', shape: 'star' },
    { id: 'dragon',   name: '巨龙',      emoji: '🐉', symbol: '龙', faction: 'neutral',  c1: '#E8B63B', c2: '#B8860B', border: '#FFD060', glow: '#D4A020', shape: 'cross' }
  ];

  const SPECIALS = {
    LINE_H:  { id: 'line_h',  name: '横向风暴', symbol: '⚡', desc: '风暴之怒横扫一行' },
    LINE_V:  { id: 'line_v',  name: '纵向雷击', symbol: '⚡', desc: '雷霆之力贯穿一列' },
    BOMB:    { id: 'bomb',    name: '奥术爆破', symbol: '💥', desc: '奥术能量爆破3×3区域' },
    RAINBOW: { id: 'rainbow', name: '虹彩宝石', symbol: '🌈', desc: '净化所有同色棋子' }
  };

  const OBSTACLES = {
    ICE:   { id: 'ice',   name: '冰封', hp: 2, symbol: '🧊' },
    STONE: { id: 'stone', name: '岩石', hp: -1, symbol: '🪨' },
    VINE:  { id: 'vine',  name: '藤蔓', hp: 1, symbol: '🌿', spreads: true }
  };

  const FACTION_COLORS = {
    horde:    { primary: '#E83030', light: '#FF5555' },
    alliance: { primary: '#3070E8', light: '#5599FF' },
    neutral:  { primary: '#D4A020', light: '#FFD050' }
  };

  // ======== EMOJI PRE-CACHE ========
  // Render emoji to offscreen canvases once, then use drawImage for reliability
  const emojiCache = {};
  let cacheReady = false;

  function buildEmojiCache() {
    const sizes = [28, 36, 44, 52];
    TYPES.forEach((g, idx) => {
      sizes.forEach(s => {
        const key = `${idx}_${s}`;
        const off = document.createElement('canvas');
        const sz = s * 2; // render at 2x for clarity
        off.width = sz;
        off.height = sz;
        const octx = off.getContext('2d');
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        // Try emoji first
        const fontSize = Math.round(sz * 0.55);
        octx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        octx.fillText(g.emoji, sz / 2, sz / 2);
        // Check if anything was actually drawn
        const data = octx.getImageData(0, 0, sz, sz).data;
        let hasContent = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 10) { hasContent = true; break; }
        }
        if (!hasContent) {
          // Emoji failed — draw shape fallback
          octx.clearRect(0, 0, sz, sz);
          drawShapeFallback(octx, sz / 2, sz / 2, sz * 0.35, g);
        }
        emojiCache[key] = off;
      });
    });
    cacheReady = true;
  }

  function drawShapeFallback(ctx, cx, cy, r, gemType) {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = gemType.border;
    ctx.lineWidth = 2;
    switch (gemType.shape) {
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.7, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r * 0.7, cy);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'hexagon':
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i - Math.PI / 6;
          const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // crescent
        ctx.fillStyle = gemType.c1;
        ctx.beginPath();
        ctx.arc(cx + r * 0.25, cy, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.87, cy + r * 0.5);
        ctx.lineTo(cx - r * 0.87, cy + r * 0.5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'square':
        ctx.fillRect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
        ctx.strokeRect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
        break;
      case 'star':
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 5 * i - Math.PI / 2;
          const rad = i % 2 === 0 ? r : r * 0.45;
          const px = cx + rad * Math.cos(a), py = cy + rad * Math.sin(a);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'cross':
        const t = r * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx - t, cy - r); ctx.lineTo(cx + t, cy - r);
        ctx.lineTo(cx + t, cy - t); ctx.lineTo(cx + r, cy - t);
        ctx.lineTo(cx + r, cy + t); ctx.lineTo(cx + t, cy + t);
        ctx.lineTo(cx + t, cy + r); ctx.lineTo(cx - t, cy + r);
        ctx.lineTo(cx - t, cy + t); ctx.lineTo(cx - r, cy + t);
        ctx.lineTo(cx - r, cy - t); ctx.lineTo(cx - t, cy - t);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
    }
    // Draw Chinese character label
    ctx.fillStyle = gemType.c2;
    ctx.font = `bold ${r * 0.7}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gemType.symbol, cx, cy);
    ctx.restore();
  }

  // Build cache on load
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildEmojiCache);
    } else {
      setTimeout(buildEmojiCache, 0);
    }
  }

  function createGem(typeIndex, special) {
    return { type: typeIndex, special: special || null, obstacle: null, marked: false };
  }

  function createObstacle(obstacleId) {
    const obs = OBSTACLES[obstacleId.toUpperCase()];
    if (!obs) return null;
    return { type: null, special: null, obstacle: { id: obs.id, hp: obs.hp, maxHp: Math.abs(obs.hp) }, marked: false };
  }

  function getSpecialFromMatch(matchCells, swapDir) {
    const count = matchCells.length;
    if (count >= 5) return 'rainbow';
    const rows = new Set(matchCells.map(c => c.row));
    const cols = new Set(matchCells.map(c => c.col));
    if (rows.size >= 2 && cols.size >= 2 && count >= 4) return 'bomb';
    if (count === 4) {
      if (rows.size === 1) return 'line_h';
      if (cols.size === 1) return 'line_v';
      return swapDir === 'h' ? 'line_h' : 'line_v';
    }
    return null;
  }

  // ======== DRAWING ========

  function drawGem(ctx, x, y, size, gem, scale, alpha, time) {
    if (!gem || gem.type === null || gem.type === undefined) return;
    if (alpha <= 0 || scale <= 0) return;
    const g = TYPES[gem.type];
    if (!g) return;

    const cx = x + size / 2;
    const cy = y + size / 2;
    const margin = size * 0.04;
    const tileW = (size - margin * 2) * scale;
    const half = tileW / 2;
    const cr = tileW * 0.14;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Glow effect behind tile
    ctx.shadowColor = g.glow;
    ctx.shadowBlur = 6 * scale;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, cx - half + 1.5, cy - half + 2.5, tileW, tileW, cr);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Main tile — BRIGHT gradient (lighter direction)
    const grad = ctx.createLinearGradient(cx - half, cy - half, cx + half, cy + half);
    grad.addColorStop(0, g.c1);
    grad.addColorStop(0.5, lightenColor(g.c1, 20));
    grad.addColorStop(1, g.c2);
    roundRect(ctx, cx - half, cy - half, tileW, tileW, cr);
    ctx.fillStyle = grad;
    ctx.fill();

    // Top bevel highlight — stronger
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, cx - half + 2, cy - half + 2, tileW - 4, tileW * 0.35, cr - 1);
    ctx.fill();

    // Bottom edge depth
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    roundRect(ctx, cx - half + 2, cy + half - tileW * 0.15, tileW - 4, tileW * 0.13, cr - 1);
    ctx.fill();

    // Border — faction colored, thick, with glow
    roundRect(ctx, cx - half, cy - half, tileW, tileW, cr);
    ctx.strokeStyle = g.border;
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.stroke();

    // Draw emoji/icon — use pre-cached image for reliability
    const nearestSize = getNearestCacheSize(tileW);
    const cacheKey = `${gem.type}_${nearestSize}`;
    if (cacheReady && emojiCache[cacheKey]) {
      const img = emojiCache[cacheKey];
      const drawSize = tileW * 0.75;
      ctx.drawImage(img, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize);
    } else {
      // Fallback: draw emoji directly (may not work on all browsers)
      const emojiSize = Math.round(tileW * 0.52);
      ctx.font = `${emojiSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillText(g.emoji, cx + 1, cy + 2);
      ctx.fillStyle = '#fff';
      ctx.fillText(g.emoji, cx, cy);
    }

    // Faction diamond indicator — top right corner
    const fc = FACTION_COLORS[g.faction];
    if (fc) {
      const fx = cx + half - tileW * 0.14;
      const fy = cy - half + tileW * 0.14;
      const fr = tileW * 0.06;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = fc.primary;
      ctx.shadowColor = fc.light;
      ctx.shadowBlur = 4;
      ctx.fillRect(-fr, -fr, fr * 2, fr * 2);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-fr, -fr, fr * 2, fr * 2);
      ctx.restore();
    }

    // Special gem overlay
    if (gem.special) drawSpecialIndicator(ctx, cx, cy, half, gem.special, time || 0);

    // Obstacle overlay
    if (gem.obstacle) drawObstacleOverlay(ctx, x, y, size, gem.obstacle);

    ctx.restore();
  }

  function getNearestCacheSize(tileW) {
    const sizes = [28, 36, 44, 52];
    let best = sizes[0];
    for (const s of sizes) {
      if (Math.abs(s - tileW) < Math.abs(best - tileW)) best = s;
    }
    return best;
  }

  function lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xFF) + percent);
    const g = Math.min(255, ((num >> 8) & 0xFF) + percent);
    const b = Math.min(255, (num & 0xFF) + percent);
    return `rgb(${r},${g},${b})`;
  }

  function drawSpecialIndicator(ctx, cx, cy, half, special, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.004);
    ctx.save();

    switch (special) {
      case 'line_h':
        ctx.strokeStyle = `rgba(255,255,100,${0.6 + 0.3 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - half * 0.7, cy);
        ctx.lineTo(cx + half * 0.7, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - half * 0.7, cy - 3);
        ctx.lineTo(cx - half * 0.9, cy);
        ctx.lineTo(cx - half * 0.7, cy + 3);
        ctx.moveTo(cx + half * 0.7, cy - 3);
        ctx.lineTo(cx + half * 0.9, cy);
        ctx.lineTo(cx + half * 0.7, cy + 3);
        ctx.stroke();
        break;
      case 'line_v':
        ctx.strokeStyle = `rgba(255,255,100,${0.6 + 0.3 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - half * 0.7);
        ctx.lineTo(cx, cy + half * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - half * 0.7);
        ctx.lineTo(cx, cy - half * 0.9);
        ctx.lineTo(cx + 3, cy - half * 0.7);
        ctx.moveTo(cx - 3, cy + half * 0.7);
        ctx.lineTo(cx, cy + half * 0.9);
        ctx.lineTo(cx + 3, cy + half * 0.7);
        ctx.stroke();
        break;
      case 'bomb':
        ctx.strokeStyle = `rgba(255,140,0,${0.5 + 0.4 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - half * 0.5, cy - half * 0.5);
        ctx.lineTo(cx + half * 0.5, cy + half * 0.5);
        ctx.moveTo(cx + half * 0.5, cy - half * 0.5);
        ctx.lineTo(cx - half * 0.5, cy + half * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, half * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'rainbow': {
        const colors = ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#0088FF', '#8800FF'];
        const angle = (time || 0) * 0.003;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6 + 0.3 * pulse;
        for (let i = 0; i < colors.length; i++) {
          const a = angle + (Math.PI * 2 * i) / colors.length;
          ctx.strokeStyle = colors[i];
          ctx.beginPath();
          ctx.arc(cx, cy, half * 0.8, a, a + Math.PI * 2 / colors.length);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  function drawObstacleOverlay(ctx, x, y, size, obstacle) {
    const margin = size * 0.04;
    const tileW = size - margin * 2;
    const tx = x + margin;
    const ty = y + margin;
    const cr = tileW * 0.14;

    ctx.save();
    ctx.globalAlpha = 0.55;

    if (obstacle.id === 'ice') {
      ctx.fillStyle = obstacle.hp > 1 ? 'rgba(173,216,230,0.6)' : 'rgba(173,216,230,0.3)';
      roundRect(ctx, tx, ty, tileW, tileW, cr);
      ctx.fill();
      if (obstacle.hp <= 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx + tileW * 0.3, ty + tileW * 0.2);
        ctx.lineTo(tx + tileW * 0.5, ty + tileW * 0.5);
        ctx.lineTo(tx + tileW * 0.7, ty + tileW * 0.35);
        ctx.stroke();
      }
    } else if (obstacle.id === 'stone') {
      ctx.fillStyle = 'rgba(100,100,100,0.75)';
      roundRect(ctx, tx, ty, tileW, tileW, cr);
      ctx.fill();
      ctx.font = `${tileW * 0.45}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.8;
      ctx.fillText('🪨', tx + tileW / 2, ty + tileW / 2);
    } else if (obstacle.id === 'vine') {
      ctx.strokeStyle = 'rgba(34,139,34,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx + 4, ty + tileW / 2);
      ctx.quadraticCurveTo(tx + tileW / 2, ty + 4, tx + tileW - 4, ty + tileW / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx + tileW / 2, ty + 4);
      ctx.quadraticCurveTo(tx + tileW - 4, ty + tileW / 2, tx + tileW / 2, ty + tileW - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); }
    else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  return {
    TYPES, SPECIALS, OBSTACLES, FACTION_COLORS,
    createGem, createObstacle, getSpecialFromMatch,
    drawGem, drawObstacleOverlay,
    COUNT: TYPES.length,
    rebuildCache: buildEmojiCache
  };
})();
