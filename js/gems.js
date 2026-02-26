/**
 * gems.js — WoW种族棋子系统
 * 艾泽拉斯消消乐 — 部落 vs 联盟 种族对决
 */
'use strict';

const Gems = (() => {
  // 7 WoW race types — 3 Alliance, 3 Horde, 1 Neutral
  const TYPES = [
    { id: 'human',    name: '人类骑士',  emoji: '⚔️', faction: 'alliance', c1: '#2B5EA7', c2: '#152E53', border: '#5B9AE8', glow: '#3A7BD5' },
    { id: 'orc',      name: '兽人狂战',  emoji: '🪓',  faction: 'horde',    c1: '#9B2C2C', c2: '#4D1616', border: '#D45555', glow: '#B33C3C' },
    { id: 'nightelf', name: '暗夜精灵',  emoji: '🌙', faction: 'alliance', c1: '#6B3FA0', c2: '#351F50', border: '#9B6FC0', glow: '#7B4FB0' },
    { id: 'undead',   name: '亡灵术士',  emoji: '💀', faction: 'horde',    c1: '#2E7A4B', c2: '#173D25', border: '#4ACA7B', glow: '#2EAA5B' },
    { id: 'tauren',   name: '牛头人',    emoji: '🦬', faction: 'horde',    c1: '#A67C2E', c2: '#533E17', border: '#D4A052', glow: '#C49A3C' },
    { id: 'dwarf',    name: '矮人铁匠',  emoji: '🔨', faction: 'alliance', c1: '#4A7A9A', c2: '#253D4D', border: '#6A9ABA', glow: '#5A8AAA' },
    { id: 'dragon',   name: '巨龙',      emoji: '🐉', faction: 'neutral',  c1: '#B8860B', c2: '#5C4305', border: '#E8B63B', glow: '#D4A020' }
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
    horde:    { primary: '#B30000', light: '#FF4444' },
    alliance: { primary: '#0046B3', light: '#4488FF' },
    neutral:  { primary: '#B8860B', light: '#E8C63B' }
  };

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
      if (rows.size === 1) return 'line_v';
      if (cols.size === 1) return 'line_h';
      return swapDir === 'h' ? 'line_v' : 'line_h';
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

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, cx - half + 1.5, cy - half + 2.5, tileW, tileW, cr);
    ctx.fill();

    // Main tile — rich gradient
    const grad = ctx.createLinearGradient(cx - half, cy - half, cx + half, cy + half);
    grad.addColorStop(0, g.c1);
    grad.addColorStop(0.5, g.c2);
    grad.addColorStop(1, g.c1);
    roundRect(ctx, cx - half, cy - half, tileW, tileW, cr);
    ctx.fillStyle = grad;
    ctx.fill();

    // Top bevel highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, cx - half + 2, cy - half + 2, tileW - 4, tileW * 0.3, cr - 1);
    ctx.fill();

    // Bottom edge depth
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    roundRect(ctx, cx - half + 2, cy + half - tileW * 0.15, tileW - 4, tileW * 0.13, cr - 1);
    ctx.fill();

    // Border — faction colored, thick
    roundRect(ctx, cx - half, cy - half, tileW, tileW, cr);
    ctx.strokeStyle = g.border;
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.stroke();

    // Large centered emoji — with shadow for depth
    const emojiSize = Math.round(tileW * 0.52);
    ctx.font = `${emojiSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillText(g.emoji, cx + 1, cy + 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(g.emoji, cx, cy);

    // Faction diamond indicator — top right corner
    const fc = FACTION_COLORS[g.faction];
    if (fc) {
      const fx = cx + half - tileW * 0.14;
      const fy = cy - half + tileW * 0.14;
      const fr = tileW * 0.055;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = fc.primary;
      ctx.fillRect(-fr, -fr, fr * 2, fr * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
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
      case 'rainbow':
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
    COUNT: TYPES.length
  };
})();
