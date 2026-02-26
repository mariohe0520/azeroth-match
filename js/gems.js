/**
 * gems.js — 魔法宝石类型、特殊宝石系统
 * 艾泽拉斯消消乐 — World of Warcraft Theme
 */
'use strict';

const Gems = (() => {
  // 7 base gem types — WoW magical resources
  const TYPES = [
    { id: 'arcane',    name: '奥术水晶', emoji: '💜', c1: '#B794F6', c2: '#805AD5', glow: '#D6BCFA' },
    { id: 'fel',       name: '邪能之火', emoji: '💚', c1: '#68D391', c2: '#38A169', glow: '#9AE6B4' },
    { id: 'frost',     name: '冰霜碎片', emoji: '💠', c1: '#63B3ED', c2: '#3182CE', glow: '#90CDF4' },
    { id: 'fire',      name: '烈焰之心', emoji: '🔥', c1: '#FC8181', c2: '#E53E3E', glow: '#FEB2B2' },
    { id: 'shadow',    name: '暗影宝珠', emoji: '🖤', c1: '#A0AEC0', c2: '#4A5568', glow: '#CBD5E0' },
    { id: 'nature',    name: '自然精华', emoji: '🌿', c1: '#9AE6B4', c2: '#48BB78', glow: '#C6F6D5' },
    { id: 'holy',      name: '圣光之泪', emoji: '✨', c1: '#FEFCBF', c2: '#ECC94B', glow: '#FFF9C4' }
  ];

  const SPECIALS = {
    LINE_H:  { id: 'line_h',  name: '横向风暴', symbol: '⚡', desc: '风暴之怒横扫一行' },
    LINE_V:  { id: 'line_v',  name: '纵向雷击', symbol: '⚡', desc: '雷霆之力贯穿一列' },
    BOMB:    { id: 'bomb',    name: '奥术爆破', symbol: '💥', desc: '奥术能量爆破3×3区域' },
    RAINBOW: { id: 'rainbow', name: '虹彩宝石', symbol: '🌈', desc: '净化所有同色魔法宝石' }
  };

  const OBSTACLES = {
    ICE:   { id: 'ice',   name: '冰封', hp: 2, symbol: '🧊' },
    STONE: { id: 'stone', name: '岩石', hp: -1, symbol: '🪨' },
    VINE:  { id: 'vine',  name: '藤蔓', hp: 1, symbol: '🌿', spreads: true }
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

  function drawGem(ctx, x, y, size, gem, scale, alpha, time) {
    if (!gem || gem.type === null || gem.type === undefined) return;
    if (alpha <= 0 || scale <= 0) return;
    const g = TYPES[gem.type];
    if (!g) return;

    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size * 0.38 * scale;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(cx + 1, cy + 2, r * 0.92, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();

    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
    grad.addColorStop(0, g.c1);
    grad.addColorStop(1, g.c2);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    const inner = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r * 0.82);
    inner.addColorStop(0, 'rgba(255,255,255,0.3)');
    inner.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = inner;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx - r * 0.2, cy - r * 0.22, r * 0.32, r * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    ctx.font = `${Math.round(size * 0.32 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.emoji, cx, cy + 1);

    if (gem.special) drawSpecialIndicator(ctx, cx, cy, r, gem.special, time || 0);
    if (gem.obstacle) drawObstacleOverlay(ctx, x, y, size, gem.obstacle);

    if (time && !gem.special) {
      const pulse = Math.sin(time * 0.002 + gem.type * 0.7) * 0.08;
      if (pulse > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = g.glow.replace(')', `,${pulse})`).replace('rgb', 'rgba');
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSpecialIndicator(ctx, cx, cy, r, special, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.004);
    ctx.save();
    switch (special) {
      case 'line_h':
        ctx.strokeStyle = `rgba(255,255,100,${0.6 + 0.3 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy); ctx.lineTo(cx + r * 0.7, cy); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.7, cy - 3); ctx.lineTo(cx - r * 0.9, cy); ctx.lineTo(cx - r * 0.7, cy + 3);
        ctx.moveTo(cx + r * 0.7, cy - 3); ctx.lineTo(cx + r * 0.9, cy); ctx.lineTo(cx + r * 0.7, cy + 3);
        ctx.stroke(); break;
      case 'line_v':
        ctx.strokeStyle = `rgba(255,255,100,${0.6 + 0.3 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.7); ctx.lineTo(cx, cy + r * 0.7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - r * 0.7); ctx.lineTo(cx, cy - r * 0.9); ctx.lineTo(cx + 3, cy - r * 0.7);
        ctx.moveTo(cx - 3, cy + r * 0.7); ctx.lineTo(cx, cy + r * 0.9); ctx.lineTo(cx + 3, cy + r * 0.7);
        ctx.stroke(); break;
      case 'bomb':
        ctx.strokeStyle = `rgba(255,140,0,${0.5 + 0.4 * pulse})`;
        ctx.lineWidth = 2;
        const br = r * 0.65;
        ctx.beginPath(); ctx.arc(cx, cy, br, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - br * 0.5, cy - br * 0.5); ctx.lineTo(cx + br * 0.5, cy + br * 0.5);
        ctx.moveTo(cx + br * 0.5, cy - br * 0.5); ctx.lineTo(cx - br * 0.5, cy + br * 0.5);
        ctx.stroke(); break;
      case 'rainbow':
        const angle = (time || 0) * 0.003;
        const colors = ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#0088FF', '#8800FF'];
        for (let i = 0; i < colors.length; i++) {
          const a = angle + (Math.PI * 2 * i) / colors.length;
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, a, a + Math.PI * 2 / colors.length);
          ctx.strokeStyle = colors[i]; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.6 + 0.3 * pulse; ctx.stroke();
        } break;
    }
    ctx.restore();
  }

  function drawObstacleOverlay(ctx, x, y, size, obstacle) {
    ctx.save(); ctx.globalAlpha = 0.5;
    if (obstacle.id === 'ice') {
      ctx.fillStyle = obstacle.hp > 1 ? 'rgba(173,216,230,0.6)' : 'rgba(173,216,230,0.3)';
      roundRect(ctx, x + 2, y + 2, size - 4, size - 4, 8); ctx.fill();
      if (obstacle.hp <= 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(x + size * 0.3, y + size * 0.2); ctx.lineTo(x + size * 0.5, y + size * 0.5);
        ctx.lineTo(x + size * 0.7, y + size * 0.4); ctx.stroke();
      }
    } else if (obstacle.id === 'stone') {
      ctx.fillStyle = 'rgba(120,120,120,0.7)'; roundRect(ctx, x + 2, y + 2, size - 4, size - 4, 8); ctx.fill();
      ctx.font = `${size * 0.4}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.8; ctx.fillText('🪨', x + size / 2, y + size / 2);
    } else if (obstacle.id === 'vine') {
      ctx.strokeStyle = 'rgba(34,139,34,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 4, y + size / 2);
      ctx.quadraticCurveTo(x + size / 2, y + 4, x + size - 4, y + size / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + size / 2, y + 4);
      ctx.quadraticCurveTo(x + size - 4, y + size / 2, x + size / 2, y + size - 4); ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); }
    else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  }

  return { TYPES, SPECIALS, OBSTACLES, createGem, createObstacle, getSpecialFromMatch, drawGem, drawObstacleOverlay, COUNT: TYPES.length };
})();
