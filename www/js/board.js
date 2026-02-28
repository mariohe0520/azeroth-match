/**
 * board.js -- Core match-3 engine with differentiation features
 * Grid management, match detection, cascade clearing, gravity, animations
 *
 * Differentiation features:
 *  1. Smart Hint System with Cascading Preview
 *  2. Progressive Weather/Time System
 *  3. Combo Rhythm System
 *  5. Move Preview on Hover/Touch
 */
'use strict';

const Board = (() => {
  // Board state
  let grid = [];          // 2D array of gem objects
  let rows = 8, cols = 8;
  let cellSize = 50;
  let padding = 4;
  let cellVisual = [];    // visual position/scale/alpha per cell
  let selected = null;
  let phase = 'idle';     // idle | animating | gameover | paused | boss
  let touchStart = null;

  // Animation queues
  let animations = [];
  let particles = [];
  let floatTexts = [];
  let shakeAmount = 0;
  const shakeDecay = 0.88;

  // Game state for current level
  let score = 0;
  let combo = 0;
  let movesLeft = 25;
  let timeLeft = -1;      // -1 = no time limit
  let targetScore = 500;
  let objectives = null;  // { type, target, current }
  let collectProgress = {};
  let bossHp = 0;
  let bossMaxHp = 0;

  // Level config
  let levelConfig = null;

  // Callbacks
  let onMoveComplete = null;  // called after each valid move resolves
  let onLevelComplete = null;
  let onLevelFail = null;
  let onScoreChange = null;
  let onCombo = null;

  // Canvas
  let canvas = null;
  let ctx = null;

  // ======== FEATURE 1: Smart Hint System ========
  let hintTimer = 0;
  const HINT_DELAY = 5.0; // seconds of idle before hint
  let hintData = null;    // { move: {r1,c1,r2,c2}, matchCells: [], cascadePreview: [] }
  let hintActive = false;
  let lastInputTime = 0;

  // ======== FEATURE 2: Progressive Weather/Time System ========
  let sessionStartTime = 0;   // timestamp when session started
  let weatherParticles = [];   // separate particle array for weather
  const MAX_WEATHER_PARTICLES = 80;
  let weatherPhase = 'dawn';   // dawn | day | sunset | night
  let isRaining = false;
  let rainTimer = 0;
  let nextRainTime = 120;      // seconds until next rain

  // ======== FEATURE 3: Combo Rhythm System ========
  const RHYTHM_PERIOD = 2.0;  // 2 seconds per beat
  const RHYTHM_WINDOW = 0.2;  // 200ms timing window
  let rhythmTimer = 0;
  let rhythmMultiplier = 1.0;
  let rhythmStreak = 0;
  let rhythmFlashAlpha = 0;
  let lastMatchTime = 0;
  let rhythmBonusTexts = [];

  // ======== FEATURE 5: Move Preview on Hover/Touch ========
  let hoverCell = null;        // cell mouse/touch is hovering over
  let previewSwapGhost = null; // { gem1, gem2, pos1, pos2, matchCells }

  // Reduced motion preference
  let prefersReducedMotion = false;

  // ======== INITIALIZATION ========

  function init(canvasEl, config) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');

    // Check reduced motion preference
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotion = mq.matches;
      mq.addEventListener('change', () => { prefersReducedMotion = mq.matches; });
    }

    if (config) applyConfig(config);
    setupInput();

    let resizeTimeout = null;
    window.addEventListener('resize', () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (phase !== 'animating') {
          updateCanvasSize();
          initCellVisual();
        }
      }, 200);
    });
  }

  function applyConfig(config) {
    levelConfig = config;
    rows = config.rows || 8;
    cols = config.cols || 8;
    targetScore = config.targetScore || 500;
    movesLeft = config.moves || 25;
    timeLeft = (config.timeLimit !== undefined && config.timeLimit !== null && config.timeLimit >= 0) ? config.timeLimit : -1;
    objectives = config.objectives || null;
    bossHp = config.bossHp || 0;
    bossMaxHp = bossHp;
    collectProgress = {};
    if (objectives && objectives.type === 'collect') {
      objectives.items.forEach(item => { collectProgress[item.gemType] = 0; });
    }
  }

  // Ice block tracking for "ice block" levels
  let iceBlocks = {}; // "row,col" -> { hp: N }
  // Falling-sand mode
  let fallingSandMode = false;
  // Boss attack timer
  let bossAttackTimer = 0;
  let bossAttackInterval = 8; // seconds between attacks
  let bossPhase = 1;
  // Move score tracking
  let moveStartScore = 0;
  let lastMoveGemCount = 0;

  function startLevel(config) {
    applyConfig(config);
    score = 0;
    combo = 0;
    selected = null;
    phase = 'idle';
    animations = [];
    particles = [];
    floatTexts = [];
    shakeAmount = 0;

    // Reset feature states
    hintTimer = 0;
    hintData = null;
    hintActive = false;
    lastInputTime = performance.now();
    sessionStartTime = performance.now();
    weatherParticles = [];
    weatherPhase = 'dawn';
    isRaining = false;
    rainTimer = 0;
    nextRainTime = 60 + Math.random() * 120;
    rhythmTimer = 0;
    rhythmMultiplier = 1.0;
    rhythmStreak = 0;
    rhythmFlashAlpha = 0;
    lastMatchTime = 0;
    hoverCell = null;
    previewSwapGhost = null;

    // Reset premium effects
    Effects.resetAll();
    iceBlocks = {};
    fallingSandMode = config.fallingSand || false;
    bossAttackTimer = 0;
    bossAttackInterval = 8;
    bossPhase = 1;
    moveStartScore = 0;
    lastMoveGemCount = 0;

    // Setup ice blocks from config
    if (config.iceBlocks) {
      config.iceBlocks.forEach(ib => {
        iceBlocks[`${ib.row},${ib.col}`] = { hp: ib.hp || 2 };
      });
    }

    updateCanvasSize();
    generateGrid(config.obstacles || []);

    // Ensure no initial matches
    let attempts = 0;
    while (findMatches().length > 0 && attempts < 100) {
      generateGrid(config.obstacles || []);
      attempts++;
    }

    // Entrance drop animation
    const drops = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] && grid[r][c].type !== null) {
          const fromY = -(rows - r + Math.random() * 2) * cellSize;
          cellVisual[r][c].y = fromY;
          drops.push({ row: r, col: c, fromY });
        }
      }
    }
    animations.push(new DropAnim(drops, 0.5, null));
  }

  function generateGrid(obstacles) {
    grid = [];
    initCellVisual();

    // Place obstacles first
    const obsMap = {};
    obstacles.forEach(o => { obsMap[`${o.row},${o.col}`] = o; });

    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        const obsKey = `${r},${c}`;
        if (obsMap[obsKey]) {
          const obs = obsMap[obsKey];
          if (obs.type === 'stone') {
            grid[r][c] = Gems.createObstacle('stone');
          } else {
            // Ice/vine: has a gem underneath
            const gem = Gems.createGem(getRandomType(r, c));
            gem.obstacle = { id: obs.type, hp: obs.hp || (obs.type === 'ice' ? 2 : 1) };
            grid[r][c] = gem;
          }
        } else {
          grid[r][c] = Gems.createGem(getRandomType(r, c));
        }
      }
    }
  }

  function getRandomType(row, col) {
    // Avoid creating matches during generation
    const numTypes = levelConfig ? (levelConfig.gemCount || Gems.COUNT) : Gems.COUNT;
    let type, attempts = 0;
    do {
      type = Math.floor(Math.random() * numTypes);
      attempts++;
    } while (attempts < 50 && wouldMatchAt(row, col, type));
    return type;
  }

  function wouldMatchAt(row, col, type) {
    // Check left
    if (col >= 2 && grid[row][col - 1] && grid[row][col - 2] &&
        grid[row][col - 1].type === type && grid[row][col - 2].type === type) return true;
    // Check up
    if (row >= 2 && grid[row - 1] && grid[row - 2] &&
        grid[row - 1][col] && grid[row - 2][col] &&
        grid[row - 1][col].type === type && grid[row - 2][col].type === type) return true;
    return false;
  }

  function initCellVisual() {
    cellVisual = [];
    for (let r = 0; r < rows; r++) {
      cellVisual[r] = [];
      for (let c = 0; c < cols; c++) {
        cellVisual[r][c] = {
          x: c * cellSize + padding,
          y: r * cellSize + padding,
          scale: 1,
          alpha: 1
        };
      }
    }
  }

  function updateCanvasSize() {
    const container = document.getElementById('boardContainer');
    if (!container || !canvas) return;
    const maxW = container.clientWidth - 8;
    cellSize = Math.floor(Math.min(60, (maxW - padding * 2) / cols));
    cellSize = Math.max(46, cellSize); // minimum 46px for better visibility
    const w = cols * cellSize + padding * 2;
    const h = rows * cellSize + padding * 2;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    initCellVisual();
  }

  // ======== MATCH DETECTION ========

  function findMatches(gridRef) {
    const g = gridRef || grid;
    const matched = [];

    // Horizontal matches
    for (let r = 0; r < rows; r++) {
      let c = 0;
      while (c < cols) {
        const cell = g[r][c];
        if (!cell || cell.type === null || (cell.obstacle && cell.obstacle.id === 'stone')) {
          c++; continue;
        }
        let len = 1;
        while (c + len < cols && g[r][c + len] && g[r][c + len].type === cell.type
               && !(g[r][c + len].obstacle && g[r][c + len].obstacle.id === 'stone')) {
          len++;
        }
        if (len >= 3) {
          const group = [];
          for (let i = 0; i < len; i++) group.push({ row: r, col: c + i });
          matched.push(group);
        }
        c += len;
      }
    }

    // Vertical matches
    for (let c = 0; c < cols; c++) {
      let r = 0;
      while (r < rows) {
        const cell = g[r][c];
        if (!cell || cell.type === null || (cell.obstacle && cell.obstacle.id === 'stone')) {
          r++; continue;
        }
        let len = 1;
        while (r + len < rows && g[r + len][c] && g[r + len][c].type === cell.type
               && !(g[r + len][c].obstacle && g[r + len][c].obstacle.id === 'stone')) {
          len++;
        }
        if (len >= 3) {
          const group = [];
          for (let i = 0; i < len; i++) group.push({ row: r + i, col: c });
          matched.push(group);
        }
        r += len;
      }
    }

    // Merge overlapping groups
    return mergeMatchGroups(matched);
  }

  function mergeMatchGroups(groups) {
    // Flatten and deduplicate
    const cellMap = {};

    groups.forEach(group => {
      group.forEach(cell => {
        const key = `${cell.row},${cell.col}`;
        if (!cellMap[key]) cellMap[key] = cell;
      });
    });

    // Return as flat array of unique cells
    return Object.values(cellMap);
  }

  // Find individual match groups (for special gem creation)
  function findMatchGroups() {
    const groups = [];

    // Horizontal
    for (let r = 0; r < rows; r++) {
      let c = 0;
      while (c < cols) {
        const cell = grid[r][c];
        if (!cell || cell.type === null || (cell.obstacle && cell.obstacle.id === 'stone')) {
          c++; continue;
        }
        let len = 1;
        while (c + len < cols && grid[r][c + len] && grid[r][c + len].type === cell.type
               && !(grid[r][c + len].obstacle && grid[r][c + len].obstacle.id === 'stone')) {
          len++;
        }
        if (len >= 3) {
          const g = [];
          for (let i = 0; i < len; i++) g.push({ row: r, col: c + i });
          groups.push({ cells: g, dir: 'h', type: cell.type });
        }
        c += len;
      }
    }

    // Vertical
    for (let c = 0; c < cols; c++) {
      let r = 0;
      while (r < rows) {
        const cell = grid[r][c];
        if (!cell || cell.type === null || (cell.obstacle && cell.obstacle.id === 'stone')) {
          r++; continue;
        }
        let len = 1;
        while (r + len < rows && grid[r + len][c] && grid[r + len][c].type === cell.type
               && !(grid[r + len][c].obstacle && grid[r + len][c].obstacle.id === 'stone')) {
          len++;
        }
        if (len >= 3) {
          const g = [];
          for (let i = 0; i < len; i++) g.push({ row: r + i, col: c });
          groups.push({ cells: g, dir: 'v', type: cell.type });
        }
        r += len;
      }
    }

    return groups;
  }

  // Check if any valid moves exist
  function hasValidMoves() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c] || grid[r][c].type === null) continue;
        if (grid[r][c].obstacle && grid[r][c].obstacle.id === 'stone') continue;

        // Try swap right
        if (c + 1 < cols && grid[r][c + 1] && grid[r][c + 1].type !== null
            && !(grid[r][c + 1].obstacle && grid[r][c + 1].obstacle.id === 'stone')) {
          swapGridData(r, c, r, c + 1);
          if (findMatches().length > 0) { swapGridData(r, c, r, c + 1); return true; }
          swapGridData(r, c, r, c + 1);
        }
        // Try swap down
        if (r + 1 < rows && grid[r + 1][c] && grid[r + 1][c].type !== null
            && !(grid[r + 1][c].obstacle && grid[r + 1][c].obstacle.id === 'stone')) {
          swapGridData(r, c, r + 1, c);
          if (findMatches().length > 0) { swapGridData(r, c, r + 1, c); return true; }
          swapGridData(r, c, r + 1, c);
        }
      }
    }
    return false;
  }

  // ======== FEATURE 1: Smart Hint with Cascade Preview ========

  function findBestMove() {
    let bestMove = null;
    let bestScore = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c] || grid[r][c].type === null) continue;
        if (grid[r][c].obstacle && grid[r][c].obstacle.id === 'stone') continue;

        const neighbors = [
          { r2: r, c2: c + 1 },
          { r2: r + 1, c2: c }
        ];

        for (const n of neighbors) {
          if (n.r2 >= rows || n.c2 >= cols) continue;
          if (!grid[n.r2][n.c2] || grid[n.r2][n.c2].type === null) continue;
          if (grid[n.r2][n.c2].obstacle && grid[n.r2][n.c2].obstacle.id === 'stone') continue;

          swapGridData(r, c, n.r2, n.c2);
          const matches = findMatches();
          if (matches.length > 0) {
            // Simulate cascade to evaluate potential score
            const cascadeResult = simulateCascade(r, c, n.r2, n.c2);
            if (cascadeResult.totalScore > bestScore) {
              bestScore = cascadeResult.totalScore;
              bestMove = {
                r1: r, c1: c, r2: n.r2, c2: n.c2,
                matchCells: matches,
                cascadePreview: cascadeResult.cascadeCells
              };
            }
          }
          swapGridData(r, c, n.r2, n.c2);
        }
      }
    }

    return bestMove;
  }

  // Deep clone grid for simulation
  function cloneGrid() {
    const clone = [];
    for (let r = 0; r < rows; r++) {
      clone[r] = [];
      for (let c = 0; c < cols; c++) {
        if (grid[r][c]) {
          clone[r][c] = { type: grid[r][c].type, special: grid[r][c].special, obstacle: grid[r][c].obstacle };
        } else {
          clone[r][c] = null;
        }
      }
    }
    return clone;
  }

  function simulateCascade(r1, c1, r2, c2) {
    // Work on a clone so we don't touch real grid
    const sim = cloneGrid();
    // The swap is already applied on the real grid, so sim has the swap
    let totalScore = 0;
    let cascadeCells = [];
    let cascadeDepth = 0;
    const MAX_CASCADE_DEPTH = 3;

    while (cascadeDepth < MAX_CASCADE_DEPTH) {
      const matches = findMatches(sim);
      if (matches.length === 0) break;

      cascadeDepth++;
      totalScore += matches.length * 15 + (cascadeDepth > 1 ? cascadeDepth * 8 : 0);

      // Record first cascade cells for preview
      if (cascadeDepth <= 1) {
        cascadeCells = matches.map(m => ({ row: m.row, col: m.col }));
      }

      // Clear matched cells
      matches.forEach(m => { sim[m.row][m.col] = null; });

      // Gravity: drop gems down in simulation
      for (let c = 0; c < cols; c++) {
        let emptyRow = rows - 1;
        for (let r = rows - 1; r >= 0; r--) {
          if (sim[r][c] !== null) {
            if (r !== emptyRow) {
              sim[emptyRow][c] = sim[r][c];
              sim[r][c] = null;
            }
            emptyRow--;
          }
        }
        // Fill from top with random gems
        const numTypes = levelConfig ? (levelConfig.gemCount || Gems.COUNT) : Gems.COUNT;
        for (let r = emptyRow; r >= 0; r--) {
          if (sim[r][c] === null) {
            sim[r][c] = { type: Math.floor(Math.random() * numTypes), special: null, obstacle: null };
          }
        }
      }
    }

    return { totalScore, cascadeCells, cascadeDepth };
  }

  function updateHintSystem(dt) {
    if (phase !== 'idle' || prefersReducedMotion) {
      hintTimer = 0;
      hintActive = false;
      hintData = null;
      return;
    }

    hintTimer += dt;

    if (hintTimer >= HINT_DELAY && !hintActive) {
      const bestMove = findBestMove();
      if (bestMove) {
        hintData = bestMove;
        hintActive = true;
      }
    }
  }

  function clearHint() {
    hintTimer = 0;
    hintActive = false;
    hintData = null;
    lastInputTime = performance.now();
  }

  function renderHintOverlay(ctx, timestamp) {
    if (!hintActive || !hintData) return;

    const pulse = 0.5 + 0.5 * Math.sin((timestamp || 0) * 0.004);
    const fadeIn = Math.min(1, (hintTimer - HINT_DELAY) / 0.5); // 0.5s fade in

    ctx.save();
    ctx.globalAlpha = fadeIn * 0.6;

    // Draw highlighted swap cells with animated glow
    const cells = [
      { row: hintData.r1, col: hintData.c1 },
      { row: hintData.r2, col: hintData.c2 }
    ];

    cells.forEach(cell => {
      const x = cell.col * cellSize + padding;
      const y = cell.row * cellSize + padding;
      const glowSize = 4 + pulse * 4;

      ctx.strokeStyle = `rgba(0,255,200,${0.5 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(0,255,200,0.6)';
      ctx.shadowBlur = glowSize;
      roundRect(ctx, x + 2, y + 2, cellSize - 4, cellSize - 4, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Draw a swap arrow between the two cells
    const cx1 = hintData.c1 * cellSize + padding + cellSize / 2;
    const cy1 = hintData.r1 * cellSize + padding + cellSize / 2;
    const cx2 = hintData.c2 * cellSize + padding + cellSize / 2;
    const cy2 = hintData.r2 * cellSize + padding + cellSize / 2;
    const swapOffset = 6 * Math.sin((timestamp || 0) * 0.006);

    ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.2 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -(timestamp || 0) * 0.01;
    ctx.beginPath();
    const dx = cx2 - cx1;
    const dy = cy2 - cy1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    ctx.moveTo(cx1 + nx * swapOffset, cy1 + ny * swapOffset);
    ctx.lineTo(cx2 + nx * swapOffset, cy2 + ny * swapOffset);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw cascade preview (ghost cells)
    if (hintData.cascadePreview && hintData.cascadePreview.length > 0) {
      ctx.globalAlpha = fadeIn * 0.25 * (0.5 + 0.3 * pulse);
      hintData.cascadePreview.forEach(cell => {
        const x = cell.col * cellSize + padding;
        const y = cell.row * cellSize + padding;
        ctx.fillStyle = 'rgba(255,200,0,0.3)';
        roundRect(ctx, x + 4, y + 4, cellSize - 8, cellSize - 8, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,0,0.5)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x + 4, y + 4, cellSize - 8, cellSize - 8, 6);
        ctx.stroke();
      });

      // "Cascade!" text preview
      if (hintData.cascadePreview.length >= 3) {
        const avgX = hintData.cascadePreview.reduce((s, c) => s + c.col, 0) / hintData.cascadePreview.length;
        const avgY = hintData.cascadePreview.reduce((s, c) => s + c.row, 0) / hintData.cascadePreview.length;
        const tx = avgX * cellSize + padding + cellSize / 2;
        const ty = avgY * cellSize + padding + cellSize / 2;
        ctx.globalAlpha = fadeIn * 0.5;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('CASCADE', tx, ty);
      }
    }

    ctx.restore();
  }

  // ======== FEATURE 2: Weather/Time System ========

  function getWeatherPhase() {
    const elapsed = (performance.now() - sessionStartTime) / 1000 / 60; // minutes
    if (elapsed < 5) return 'dawn';
    if (elapsed < 15) return 'day';
    if (elapsed < 30) return 'sunset';
    return 'night';
  }

  function getWeatherColors(phase) {
    switch (phase) {
      case 'dawn':
        return { top: '#1a1020', bottom: '#2a1528', tint: 'rgba(201,120,60,0.04)' };
      case 'day':
        return { top: '#0a0e1a', bottom: '#141828', tint: 'rgba(200,220,255,0.03)' };
      case 'sunset':
        return { top: '#1a0e18', bottom: '#20102a', tint: 'rgba(180,80,130,0.05)' };
      case 'night':
        return { top: '#050810', bottom: '#0a0e18', tint: 'rgba(60,80,160,0.04)' };
      default:
        return { top: '#0a0e1a', bottom: '#141828', tint: 'rgba(200,220,255,0.02)' };
    }
  }

  function updateWeatherParticles(dt) {
    if (prefersReducedMotion) return;
    const wp = weatherPhase;

    // Rain timer
    rainTimer += dt;
    if (rainTimer >= nextRainTime) {
      isRaining = !isRaining;
      if (isRaining) {
        nextRainTime = rainTimer + 8 + Math.random() * 12; // rain for 8-20s
      } else {
        nextRainTime = rainTimer + 60 + Math.random() * 120; // pause 1-3 min
      }
    }

    // Spawn ambient particles
    if (weatherParticles.length < MAX_WEATHER_PARTICLES) {
      const spawnChance = dt * 8; // ~8 per second chance
      if (Math.random() < spawnChance) {
        const w = canvas ? canvas.width : 400;
        const h = canvas ? canvas.height : 400;

        if (wp === 'dawn' || wp === 'day') {
          // Dust motes
          weatherParticles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 8,
            vy: -5 + Math.random() * 3,
            r: 1 + Math.random() * 1.5,
            color: wp === 'dawn' ? '#FFD4A0' : '#FFFFEE',
            alpha: 0, maxAlpha: 0.15 + Math.random() * 0.15,
            life: 0, maxLife: 4 + Math.random() * 4,
            kind: 'mote'
          });
        } else if (wp === 'sunset') {
          // Ember particles drifting
          weatherParticles.push({
            x: Math.random() * w,
            y: h + 5,
            vx: (Math.random() - 0.5) * 12,
            vy: -15 - Math.random() * 10,
            r: 1 + Math.random() * 2,
            color: Math.random() > 0.5 ? '#FF8844' : '#FFaa66',
            alpha: 0, maxAlpha: 0.2 + Math.random() * 0.15,
            life: 0, maxLife: 5 + Math.random() * 5,
            kind: 'ember'
          });
        } else if (wp === 'night') {
          // Fireflies
          weatherParticles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            r: 1.5 + Math.random() * 1,
            color: '#AAFFAA',
            alpha: 0, maxAlpha: 0.3 + Math.random() * 0.3,
            life: 0, maxLife: 3 + Math.random() * 4,
            kind: 'firefly',
            flickerSpeed: 3 + Math.random() * 4
          });
        }
      }

      // Rain particles
      if (isRaining && Math.random() < dt * 20) {
        const w = canvas ? canvas.width : 400;
        weatherParticles.push({
          x: Math.random() * w,
          y: -5,
          vx: -10 + Math.random() * 5,
          vy: 150 + Math.random() * 100,
          r: 0.8,
          color: '#88BBFF',
          alpha: 0.2 + Math.random() * 0.15,
          maxAlpha: 0.3,
          life: 0, maxLife: 2 + Math.random(),
          kind: 'rain'
        });
      }
    }

    // Update weather particles
    const h = canvas ? canvas.height : 400;
    for (let i = weatherParticles.length - 1; i >= 0; i--) {
      const p = weatherParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife || p.y > h + 10) {
        weatherParticles.splice(i, 1);
        continue;
      }
      const t = p.life / p.maxLife;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.kind === 'firefly') {
        // Fireflies wander and flicker
        p.vx += (Math.random() - 0.5) * 40 * dt;
        p.vy += (Math.random() - 0.5) * 40 * dt;
        p.alpha = p.maxAlpha * (0.3 + 0.7 * Math.abs(Math.sin(p.life * p.flickerSpeed)));
        if (t > 0.7) p.alpha *= (1 - (t - 0.7) / 0.3);
      } else if (p.kind === 'rain') {
        // rain stays same alpha, dies when off screen
        p.alpha = p.maxAlpha;
      } else {
        // Fade in then fade out
        if (t < 0.2) p.alpha = p.maxAlpha * (t / 0.2);
        else if (t > 0.7) p.alpha = p.maxAlpha * (1 - (t - 0.7) / 0.3);
        else p.alpha = p.maxAlpha;
      }
    }
  }

  function renderWeatherParticles(ctx) {
    if (prefersReducedMotion) return;
    weatherParticles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      if (p.kind === 'rain') {
        // Draw rain as a short line
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.r;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02);
        ctx.stroke();
      } else if (p.kind === 'firefly') {
        // Glowing dot
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  // Rain glisten effect on gems
  function renderRainGlisten(ctx, timestamp) {
    if (!isRaining || prefersReducedMotion) return;

    ctx.save();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c] || grid[r][c].type === null) continue;
        const v = cellVisual[r][c];
        // Subtle shimmer based on position and time
        const shimmer = Math.sin((timestamp || 0) * 0.003 + r * 0.7 + c * 1.1);
        if (shimmer > 0.6) {
          ctx.globalAlpha = (shimmer - 0.6) * 0.4;
          ctx.fillStyle = '#FFFFFF';
          const sx = v.x + cellSize * 0.3 + shimmer * cellSize * 0.2;
          const sy = v.y + cellSize * 0.2;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ======== FEATURE 3: Combo Rhythm System ========

  function updateRhythmSystem(dt) {
    rhythmTimer += dt;

    // Decay rhythm flash
    if (rhythmFlashAlpha > 0) {
      rhythmFlashAlpha = Math.max(0, rhythmFlashAlpha - dt * 3);
    }

    // Reset rhythm streak if too much time has passed since last rhythm hit
    if (performance.now() - lastMatchTime > 6000 && rhythmStreak > 0) {
      rhythmStreak = 0;
      rhythmMultiplier = 1.0;
    }
  }

  function checkRhythmBonus() {
    // How close is the current time to a rhythm beat?
    const beatPosition = rhythmTimer % RHYTHM_PERIOD;
    const distanceToBeat = Math.min(beatPosition, RHYTHM_PERIOD - beatPosition);

    if (distanceToBeat <= RHYTHM_WINDOW) {
      // Rhythm hit
      rhythmStreak++;
      lastMatchTime = performance.now();

      if (rhythmStreak >= 4) rhythmMultiplier = 3.0;
      else if (rhythmStreak >= 3) rhythmMultiplier = 2.5;
      else if (rhythmStreak >= 2) rhythmMultiplier = 2.0;
      else rhythmMultiplier = 1.5;

      rhythmFlashAlpha = 0.5;

      return rhythmMultiplier;
    }

    // Missed the beat
    rhythmStreak = 0;
    rhythmMultiplier = 1.0;
    return 1.0;
  }

  function renderRhythmIndicator(ctx, timestamp, w, h) {
    if (prefersReducedMotion) return;

    // Pulse ring at bottom-right of board
    const beatPos = rhythmTimer % RHYTHM_PERIOD;
    const beatProgress = beatPos / RHYTHM_PERIOD;
    const ringX = w - 20;
    const ringY = h - 20;
    const maxR = 12;

    ctx.save();

    // Expanding ring
    const ringR = maxR * beatProgress;
    const ringAlpha = 1 - beatProgress;
    ctx.strokeStyle = `rgba(255,215,0,${ringAlpha * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot (beat point)
    const centerPulse = beatProgress < 0.1 ? 1 - beatProgress / 0.1 : 0;
    const dotR = 3 + centerPulse * 3;
    ctx.fillStyle = `rgba(255,215,0,${0.3 + centerPulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(ringX, ringY, dotR, 0, Math.PI * 2);
    ctx.fill();

    // If rhythm streak active, show multiplier
    if (rhythmStreak > 0 && rhythmMultiplier > 1.0) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.globalAlpha = 0.8;
      ctx.fillText(`x${rhythmMultiplier.toFixed(1)}`, ringX, ringY - maxR - 3);
    }

    // Rhythm flash overlay on board
    if (rhythmFlashAlpha > 0) {
      ctx.globalAlpha = rhythmFlashAlpha * 0.15;
      ctx.fillStyle = '#FFD700';
      roundRect(ctx, 0, 0, w, h, 16);
      ctx.fill();
    }

    ctx.restore();
  }

  // ======== FEATURE 5: Move Preview on Hover/Touch ========

  function updateMovePreview() {
    if (!selected || !hoverCell || phase !== 'idle') {
      previewSwapGhost = null;
      return;
    }

    // Only show preview for adjacent cells
    if (!isAdjacent(selected, hoverCell)) {
      previewSwapGhost = null;
      return;
    }

    const gem1 = grid[selected.row][selected.col];
    const gem2 = grid[hoverCell.row][hoverCell.col];
    if (!gem1 || !gem2 || gem1.type === null || gem2.type === null) {
      previewSwapGhost = null;
      return;
    }
    if ((gem1.obstacle && gem1.obstacle.id === 'stone') || (gem2.obstacle && gem2.obstacle.id === 'stone')) {
      previewSwapGhost = null;
      return;
    }

    // Check if swap would create a match
    swapGridData(selected.row, selected.col, hoverCell.row, hoverCell.col);
    const matches = findMatches();
    swapGridData(selected.row, selected.col, hoverCell.row, hoverCell.col); // swap back

    previewSwapGhost = {
      gem1: gem1,
      gem2: gem2,
      pos1: { row: selected.row, col: selected.col },
      pos2: { row: hoverCell.row, col: hoverCell.col },
      wouldMatch: matches.length > 0,
      matchCells: matches
    };
  }

  function renderMovePreview(ctx, timestamp) {
    if (!previewSwapGhost || prefersReducedMotion) return;

    const ghost = previewSwapGhost;
    const pulse = 0.5 + 0.5 * Math.sin((timestamp || 0) * 0.006);

    ctx.save();

    // Draw ghost gems at swapped positions (50% opacity)
    ctx.globalAlpha = 0.45;

    // Ghost of gem1 at pos2
    const x2 = ghost.pos2.col * cellSize + padding;
    const y2 = ghost.pos2.row * cellSize + padding;
    Gems.drawGem(ctx, x2, y2, cellSize, ghost.gem1, 0.9, 0.45, timestamp);

    // Ghost of gem2 at pos1
    const x1 = ghost.pos1.col * cellSize + padding;
    const y1 = ghost.pos1.row * cellSize + padding;
    Gems.drawGem(ctx, x1, y1, cellSize, ghost.gem2, 0.9, 0.45, timestamp);

    // If match would occur, highlight matching cells with shimmer
    if (ghost.wouldMatch && ghost.matchCells.length > 0) {
      ctx.globalAlpha = 0.2 + 0.15 * pulse;
      ghost.matchCells.forEach(cell => {
        const mx = cell.col * cellSize + padding;
        const my = cell.row * cellSize + padding;
        ctx.fillStyle = `rgba(255,255,200,${0.25 + 0.15 * pulse})`;
        roundRect(ctx, mx + 2, my + 2, cellSize - 4, cellSize - 4, 8);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,215,0,${0.4 + 0.2 * pulse})`;
        ctx.lineWidth = 1.5;
        roundRect(ctx, mx + 2, my + 2, cellSize - 4, cellSize - 4, 8);
        ctx.stroke();
      });
    }

    // Highlight valid swap targets with subtle glow when first gem is selected
    ctx.restore();
  }

  function renderValidTargets(ctx, timestamp) {
    if (!selected || phase !== 'idle' || previewSwapGhost || prefersReducedMotion) return;

    const pulse = 0.5 + 0.5 * Math.sin((timestamp || 0) * 0.005);
    const neighbors = [
      { row: selected.row - 1, col: selected.col },
      { row: selected.row + 1, col: selected.col },
      { row: selected.row, col: selected.col - 1 },
      { row: selected.row, col: selected.col + 1 }
    ];

    ctx.save();
    ctx.globalAlpha = 0.15 + 0.1 * pulse;
    neighbors.forEach(n => {
      if (n.row < 0 || n.row >= rows || n.col < 0 || n.col >= cols) return;
      const gem = grid[n.row][n.col];
      if (!gem || gem.type === null) return;
      if (gem.obstacle && gem.obstacle.id === 'stone') return;

      const x = n.col * cellSize + padding;
      const y = n.row * cellSize + padding;
      ctx.strokeStyle = `rgba(200,200,255,${0.3 + 0.15 * pulse})`;
      ctx.lineWidth = 2;
      roundRect(ctx, x + 3, y + 3, cellSize - 6, cellSize - 6, 6);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ======== SWAP & MOVE ========

  function swapGridData(r1, c1, r2, c2) {
    const temp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = temp;
  }

  function handleMove(cell1, cell2) {
    if (phase !== 'idle') return;

    // Check if rage mode is active - special tap handling
    if (Effects.isRageActive()) {
      Effects.consumeRage();
      phase = 'animating';
      Audio.playRageActivate();
      Effects.hapticHeavy();
      shakeAmount = 15;
      // Clear entire row AND column of tapped cell
      const rageCells = [];
      for (let c = 0; c < cols; c++) {
        if (grid[cell1.row][c] && grid[cell1.row][c].type !== null) {
          rageCells.push({ row: cell1.row, col: c });
        }
      }
      for (let r = 0; r < rows; r++) {
        if (r !== cell1.row && grid[r][cell1.col] && grid[r][cell1.col].type !== null) {
          rageCells.push({ row: r, col: cell1.col });
        }
      }
      score += rageCells.length * 20;
      rageCells.forEach(c => {
        const v = cellVisual[c.row] && cellVisual[c.row][c.col];
        if (v) Effects.spawnExplosion(v.x + cellSize / 2, v.y + cellSize / 2, (grid[c.row][c.col] || {}).type || 0, 8);
      });
      const clearAnim = new ClearAnim(rageCells, 0.3, () => {
        rageCells.forEach(c => { grid[c.row][c.col] = null; });
        const drops = dropAndFill();
        if (drops.length > 0) {
          Effects.triggerBoardBounce(6);
          animations.push(new DropAnim(drops, 0.3, () => { combo = 0; processMatchChain(); }));
        } else { combo = 0; processMatchChain(); }
      });
      animations.push(clearAnim);
      if (onScoreChange) onScoreChange(getState());
      return;
    }

    phase = 'animating';
    Audio.playSwap();
    Effects.hapticLight();
    clearHint(); // Feature 1: clear hint on interaction
    previewSwapGhost = null; // Feature 5: clear preview
    moveStartScore = score; // Track score at start of move

    // Spawn particle trails for the swap
    const v1 = cellVisual[cell1.row][cell1.col];
    const v2 = cellVisual[cell2.row][cell2.col];
    const gem1 = grid[cell1.row][cell1.col];
    const gem2 = grid[cell2.row][cell2.col];
    if (v1 && v2 && gem1 && gem2) {
      Effects.spawnSwapTrail(v1.x + cellSize / 2, v1.y + cellSize / 2, v2.x + cellSize / 2, v2.y + cellSize / 2, gem1.type || 0);
      Effects.spawnSwapTrail(v2.x + cellSize / 2, v2.y + cellSize / 2, v1.x + cellSize / 2, v1.y + cellSize / 2, gem2.type || 0);
    }

    swapGridData(cell1.row, cell1.col, cell2.row, cell2.col);

    const anim = new SwapAnim(cell1.row, cell1.col, cell2.row, cell2.col, 0.2, () => {
      try {
        resetVisual(cell1.row, cell1.col);
        resetVisual(cell2.row, cell2.col);

        const matches = findMatches();
        if (matches.length === 0) {
          Audio.playInvalid();
          swapGridData(cell1.row, cell1.col, cell2.row, cell2.col);
          const backAnim = new SwapAnim(cell1.row, cell1.col, cell2.row, cell2.col, 0.2, () => {
            resetVisual(cell1.row, cell1.col);
            resetVisual(cell2.row, cell2.col);
            combo = 0;
            phase = 'idle';
          });
          animations.push(backAnim);
        } else {
          if (movesLeft > 0) movesLeft--;
          combo = 0;
          processMatchChain();
        }
        selected = null;
        hoverCell = null;
        if (onScoreChange) {
          try { onScoreChange(getState()); } catch (e) {}
        }
      } catch (e) {
        console.error('[AzerothMatch] Move processing error:', e);
        selected = null;
        hoverCell = null;
        phase = 'idle';
        validateAndRepairBoard();
      }
    });
    animations.push(anim);
  }

  // ======== MATCH CHAIN PROCESSING ========

  function validateAndRepairBoard() {
    const numTypes = levelConfig ? (levelConfig.gemCount || Gems.COUNT) : Gems.COUNT;
    let repaired = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        // Skip stone obstacles (type === null is expected for stones)
        if (cell && cell.obstacle && cell.obstacle.id === 'stone') continue;
        // Fix null cells or cells with null/undefined type
        if (!cell || cell.type === null || cell.type === undefined) {
          grid[r][c] = Gems.createGem(Math.floor(Math.random() * numTypes));
          repaired = true;
        }
        // Always ensure cellVisual is valid
        if (!cellVisual[r] || !cellVisual[r][c]) {
          if (!cellVisual[r]) cellVisual[r] = [];
          cellVisual[r][c] = { x: c * cellSize + padding, y: r * cellSize + padding, scale: 1, alpha: 1 };
        }
        if (grid[r][c] && grid[r][c].type !== null) {
          if (cellVisual[r][c].scale <= 0) cellVisual[r][c].scale = 1;
          if (cellVisual[r][c].alpha <= 0) cellVisual[r][c].alpha = 1;
          cellVisual[r][c].x = c * cellSize + padding;
          cellVisual[r][c].y = r * cellSize + padding;
        }
      }
    }
    if (repaired) {
      console.warn('Board validated and repaired: filled null cells');
    }
    return repaired;
  }

  function processMatchChain() {
    if (phase === 'gameover') return;
    const matchGroups = findMatchGroups();
    const allMatches = findMatches();

    if (allMatches.length === 0) {
      // Show total move score with dramatic reveal
      const totalMoveScore = score - moveStartScore;
      if (totalMoveScore > 0 && canvas) {
        Effects.showMoveScore(totalMoveScore, canvas.width / 2, canvas.height / 2);
      }

      // Perfect move detection: check if this was the best possible move
      if (combo >= 3 && lastMoveGemCount >= 9) {
        Effects.triggerPerfectMove();
        Audio.playPerfect();
        Effects.hapticHeavy();
      }
      lastMoveGemCount = 0;

      // Boss counter-attack
      if (bossMaxHp > 0 && bossHp > 0 && phase !== 'gameover') {
        bossAttackTimer++;
        const attackThreshold = bossHp <= bossMaxHp * 0.33 ? 2 : bossHp <= bossMaxHp * 0.66 ? 3 : 4;
        if (bossAttackTimer >= attackThreshold) {
          bossAttackTimer = 0;
          const bossConfig = levelConfig && levelConfig.island ? Campaign.BOSSES[levelConfig.island.id] : null;
          const attackName = bossConfig ? bossConfig.attack : 'Boss Attack!';
          const bossPhaseNow = bossHp <= bossMaxHp * 0.33 ? 3 : bossHp <= bossMaxHp * 0.66 ? 2 : 1;
          let dmgMoves = bossPhaseNow >= 3 ? 2 : bossPhaseNow >= 2 ? 1 : 0;
          let dmgScore = bossPhaseNow >= 2 ? 50 * bossPhaseNow : 0;
          Effects.triggerBossAttack(attackName, dmgMoves, dmgScore);
          Audio.playBossAttack();
          Effects.hapticHeavy();
          shakeAmount = 12;
          if (dmgMoves > 0 && movesLeft > 1) movesLeft = Math.max(1, movesLeft - dmgMoves);
          if (dmgScore > 0) score = Math.max(0, score - dmgScore);
        }
      }

      // Validate the board is fully populated before going idle
      try {
        validateAndRepairBoard();
        // Check for no valid moves -> reshuffle
        if (!hasValidMoves() && phase !== 'gameover') {
          reshuffleBoard();
        }
        checkGameState();
      } catch (e) {
        console.error('[AzerothMatch] End-of-chain validation error:', e);
      }
      if (phase !== 'gameover') phase = 'idle';
      if (onMoveComplete) {
        try { onMoveComplete(getState()); } catch (e) {
          console.warn('[AzerothMatch] onMoveComplete callback error:', e);
        }
      }
      return;
    }

    combo++;

    // Feature 3: Check rhythm bonus
    const rhythmMult = checkRhythmBonus();

    const matchTypes = allMatches.map(c => grid[c.row] && grid[c.row][c.col] ? grid[c.row][c.col].type : 0).filter(t => t !== null && t !== undefined);
    const mainGemType = matchTypes.length > 0 ? matchTypes[0] : 0;

    // Escalating pitch chain sound
    Audio.playChainMatch(combo - 1);
    if (combo >= 2) Audio.playCombo(combo);
    if (combo >= 5) Audio.playMegaCombo(combo);

    // Haptic feedback
    Effects.hapticCombo(combo);

    // Fill rage meter
    Effects.addRage(allMatches.length * 2 + combo * 3);
    if (Effects.isRageReady()) {
      Audio.playRageReady();
    }

    // Trigger first_match achievement
    try {
      const achData = Storage.get();
      if (achData && !achData.achievements['first_match']) {
        achData.achievements['first_match'] = { unlocked: true, unlockedAt: Date.now() };
      }
      if (achData && combo >= 2 && !achData.achievements['first_combo']) {
        achData.achievements['first_combo'] = { unlocked: true, unlockedAt: Date.now() };
      }
    } catch (e) { /* non-critical */ }

    // Score calculation with rhythm multiplier
    const baseScore = allMatches.length * 15;
    const comboBonus = combo > 1 ? combo * 8 : 0;
    const rhythmBonus = rhythmMult > 1.0 ? Math.round((baseScore + comboBonus) * (rhythmMult - 1)) : 0;
    score += baseScore + comboBonus + rhythmBonus;

    // Track gem collection for objectives
    allMatches.forEach(cell => {
      const gem = grid[cell.row][cell.col];
      if (gem && gem.type !== null) {
        try {
          const typeId = Gems.TYPES[gem.type] ? Gems.TYPES[gem.type].id : null;
          if (typeId && collectProgress[typeId] !== undefined) collectProgress[typeId]++;
          // Add potion ingredients
          const data = Storage.get();
          if (data && data.potions && data.potions.ingredients) {
            const ingredientMap = ['holy', 'fire', 'arcane', 'shadow', 'nature', 'frost', 'fel'];
            const ingr = ingredientMap[gem.type] || 'holy';
            data.potions.ingredients[ingr] = (data.potions.ingredients[ingr] || 0) + 1;
          }
          if (data && data.stats) data.stats.totalGems++;
        } catch (e) {
          // Prevent storage errors from crashing the match chain
          console.warn('Storage update error during match processing:', e);
        }
      }
    });

    // Boss damage
    if (bossHp > 0) {
      const dmg = allMatches.length * 2 + (combo > 1 ? combo * 3 : 0);
      bossHp = Math.max(0, bossHp - dmg);
    }

    // Merge overlapping match groups of same type for L/T shape detection
    const mergedGroups = [];
    const groupUsed = new Array(matchGroups.length).fill(false);
    for (let i = 0; i < matchGroups.length; i++) {
      if (groupUsed[i]) continue;
      const merged = { cells: [...matchGroups[i].cells], dir: matchGroups[i].dir, type: matchGroups[i].type };
      groupUsed[i] = true;
      for (let j = i + 1; j < matchGroups.length; j++) {
        if (groupUsed[j] || matchGroups[j].type !== merged.type) continue;
        const overlaps = matchGroups[j].cells.some(c2 =>
          merged.cells.some(c1 => c1.row === c2.row && c1.col === c2.col)
        );
        if (overlaps) {
          matchGroups[j].cells.forEach(c2 => {
            if (!merged.cells.some(c1 => c1.row === c2.row && c1.col === c2.col)) {
              merged.cells.push(c2);
            }
          });
          if (matchGroups[j].dir !== merged.dir) merged.dir = 'cross';
          groupUsed[j] = true;
        }
      }
      mergedGroups.push(merged);
    }

    // Check for special gem creation
    mergedGroups.forEach(group => {
      try {
        const special = Gems.getSpecialFromMatch(group.cells, group.dir);
        if (special && group.cells.length > 0) {
          const center = group.cells[Math.floor(group.cells.length / 2)];
          center._becomeSpecial = { special, type: group.type };
          // Trigger first_special achievement
          try {
            const achData = Storage.get();
            if (achData && !achData.achievements['first_special']) {
              achData.achievements['first_special'] = { unlocked: true, unlockedAt: Date.now() };
            }
          } catch (e2) { /* non-critical */ }
        }
      } catch (e) {
        console.warn('[AzerothMatch] Special gem creation error:', e);
      }
    });

    // Process special gem activations
    const extraClears = [];
    allMatches.forEach(cell => {
      try {
        const gem = grid[cell.row] && grid[cell.row][cell.col];
        if (gem && gem.special) {
          const activated = activateSpecial(gem, cell.row, cell.col);
          if (activated && activated.length) {
            activated.forEach(ac => {
              if (!allMatches.find(m => m.row === ac.row && m.col === ac.col)) {
                extraClears.push(ac);
              }
            });
          }
        }
      } catch (e) {
        console.warn('[AzerothMatch] Special activation error:', e);
      }
    });

    const allClears = [...allMatches, ...extraClears];

    // Transfer _becomeSpecial from matchGroup cells to allClears by position
    mergedGroups.forEach(group => {
      group.cells.forEach(cell => {
        if (cell._becomeSpecial) {
          const target = allClears.find(c => c.row === cell.row && c.col === cell.col);
          if (target && target !== cell) {
            target._becomeSpecial = cell._becomeSpecial;
          }
        }
      });
    });

    // Spawn explosion bursts and individual gem score floats
    allClears.forEach(cell => {
      try {
        const v = cellVisual[cell.row] && cellVisual[cell.row][cell.col];
        const g = grid[cell.row] && grid[cell.row][cell.col];
        if (v && g && g.type !== null) {
          // Explosion burst on each cleared gem
          Effects.spawnExplosion(v.x + cellSize / 2, v.y + cellSize / 2, g.type, combo >= 5 ? 16 : 10);
          // Individual score float from each gem
          const perGemScore = 15 + (combo > 1 ? Math.round(combo * 8 / allClears.length) : 0);
          Effects.spawnGemScore(v.x + cellSize / 2, v.y, perGemScore, g.type);
        }
      } catch (e) { /* non-critical */ }
    });

    // Combo chain counter text (progressively bigger/dramatic)
    if (combo >= 2) {
      const mx = allClears.reduce((s, m) => s + m.col, 0) / allClears.length * cellSize + padding + cellSize / 2;
      const my = allClears.reduce((s, m) => s + m.row, 0) / allClears.length * cellSize + padding;
      Effects.spawnChainText(mx, my, combo);
      // Multiplier stack visual
      Effects.showMultiplier(combo, mx, my);

      if (combo >= 5) {
        shakeAmount = 8 + combo * 2;
        Audio.playExplosion();
      } else if (combo >= 3) {
        shakeAmount = 5 + combo * 1.5;
      } else {
        shakeAmount = 3 + combo * 2;
      }
    }

    // Feature 3: Rhythm bonus text
    if (rhythmBonus > 0) {
      const mx = allClears.reduce((s, m) => s + m.col, 0) / allClears.length * cellSize + padding + cellSize / 2;
      const my = allClears.reduce((s, m) => s + m.row, 0) / allClears.length * cellSize + padding + cellSize / 2 + 15;
      spawnFloatText(mx, my, `RHYTHM x${rhythmMult.toFixed(1)} +${rhythmBonus}`, '#00FF88', 0.9);
    }

    // Total move score with dramatic reveal (shown only at end of chain via check below)
    lastMoveGemCount += allClears.length;

    if (onScoreChange) onScoreChange(getState());

    // Handle obstacle damage from adjacent matches
    const obstacleHits = new Set();
    allClears.forEach(cell => {
      const neighbors = [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 }
      ];
      neighbors.forEach(n => {
        if (n.row >= 0 && n.row < rows && n.col >= 0 && n.col < cols) {
          const g = grid[n.row][n.col];
          if (g && g.obstacle && g.obstacle.id !== 'stone') {
            obstacleHits.add(`${n.row},${n.col}`);
          }
        }
      });
    });

    // Damage obstacles
    obstacleHits.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      const g = grid[r][c];
      if (g && g.obstacle && g.obstacle.hp > 0) {
        g.obstacle.hp--;
        if (g.obstacle.hp <= 0) {
          g.obstacle = null;
        }
      }
    });

    // Clear animation
    const clearAnim = new ClearAnim(allClears, 0.25, () => {
      // Create special gems before clearing
      allClears.forEach(cell => {
        try {
          if (cell._becomeSpecial) {
            grid[cell.row][cell.col] = Gems.createGem(cell._becomeSpecial.type);
            grid[cell.row][cell.col].special = cell._becomeSpecial.special;
            if (cellVisual[cell.row] && cellVisual[cell.row][cell.col]) {
              cellVisual[cell.row][cell.col].scale = 1;
              cellVisual[cell.row][cell.col].alpha = 1;
            }
          } else {
            const gem = grid[cell.row] && grid[cell.row][cell.col];
            if (gem && !(gem.obstacle && gem.obstacle.id === 'stone')) {
              grid[cell.row][cell.col] = null;
            }
          }
        } catch (e) {
          // If clearing a cell fails, just null it
          try { grid[cell.row][cell.col] = null; } catch (e2) {}
        }
      });

      try {
        const drops = dropAndFill();
        if (drops.length > 0) {
          animations.push(new DropAnim(drops, 0.3, () => processMatchChain()));
        } else {
          processMatchChain();
        }
      } catch (e) {
        console.error('[AzerothMatch] Drop/fill error:', e);
        validateAndRepairBoard();
        phase = 'idle';
      }
    });
    animations.push(clearAnim);
  }

  function activateSpecial(gem, row, col) {
    const cells = [];
    switch (gem.special) {
      case 'line_h':
        for (let c = 0; c < cols; c++) {
          if (c !== col) cells.push({ row, col: c });
        }
        shakeAmount = 6;
        break;
      case 'line_v':
        for (let r = 0; r < rows; r++) {
          if (r !== row) cells.push({ row: r, col });
        }
        shakeAmount = 6;
        break;
      case 'bomb':
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !(dr === 0 && dc === 0)) {
              cells.push({ row: nr, col: nc });
            }
          }
        }
        shakeAmount = 10;
        break;
      case 'rainbow': {
        const targetType = gem.type;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (grid[r][c] && grid[r][c].type === targetType && !(r === row && c === col)) {
              cells.push({ row: r, col: c });
            }
          }
        }
        shakeAmount = 12;
        break;
      }
    }

    // Spawn particles for special activation
    cells.forEach(cell => {
      try {
        const v = cellVisual[cell.row] && cellVisual[cell.row][cell.col];
        const g = grid[cell.row] && grid[cell.row][cell.col];
        if (v && g) {
          spawnParticles(v.x + cellSize / 2, v.y + cellSize / 2, g.type || 0, 6);
        }
      } catch (e) { /* skip particle */ }
    });

    return cells;
  }

  function reshuffleBoard() {
    let attempts = 0;
    const maxAttempts = 50;

    do {
      const gemTypes = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] && grid[r][c].type !== null && !grid[r][c].obstacle) {
            gemTypes.push(grid[r][c].type);
          }
        }
      }

      // Fisher-Yates shuffle
      for (let i = gemTypes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gemTypes[i], gemTypes[j]] = [gemTypes[j], gemTypes[i]];
      }

      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] && grid[r][c].type !== null && !grid[r][c].obstacle) {
            grid[r][c].type = gemTypes[idx++];
          }
        }
      }

      attempts++;
    } while (attempts < maxAttempts && (findMatches().length > 0 || !hasValidMoves()));

    spawnFloatText(canvas ? canvas.width / 2 : 200, canvas ? canvas.height / 2 : 200, 'Reshuffle!', '#FFD700');
  }

  // ======== DROP & FILL ========

  function dropAndFill() {
    const drops = [];

    for (let c = 0; c < cols; c++) {
      let emptyRow = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        const cell = grid[r][c];
        if (cell !== null && !(cell.obstacle && cell.obstacle.id === 'stone' && cell.type === null)) {
          if (r !== emptyRow) {
            grid[emptyRow][c] = grid[r][c];
            grid[r][c] = null;
            const fromY = cellVisual[r][c].y;
            cellVisual[emptyRow][c].x = c * cellSize + padding;
            cellVisual[emptyRow][c].scale = 1;
            cellVisual[emptyRow][c].alpha = 1;
            drops.push({ row: emptyRow, col: c, fromY });
          }
          emptyRow--;
        } else if (cell && cell.obstacle && cell.obstacle.id === 'stone') {
          emptyRow = r - 1;
        }
      }
      // Fill from top
      for (let r = emptyRow; r >= 0; r--) {
        if (grid[r][c] === null) {
          const numTypes = levelConfig ? (levelConfig.gemCount || Gems.COUNT) : Gems.COUNT;
          grid[r][c] = Gems.createGem(Math.floor(Math.random() * numTypes));
          const fromY = -(emptyRow - r + 1) * cellSize;
          cellVisual[r][c].x = c * cellSize + padding;
          cellVisual[r][c].scale = 1;
          cellVisual[r][c].alpha = 1;
          drops.push({ row: r, col: c, fromY });
        }
      }
    }

    // Safety pass: check ALL cells and fill any remaining nulls
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === null) {
          const numTypes = levelConfig ? (levelConfig.gemCount || Gems.COUNT) : Gems.COUNT;
          grid[r][c] = Gems.createGem(Math.floor(Math.random() * numTypes));
          cellVisual[r][c].x = c * cellSize + padding;
          cellVisual[r][c].y = r * cellSize + padding;
          cellVisual[r][c].scale = 1;
          cellVisual[r][c].alpha = 1;
          drops.push({ row: r, col: c, fromY: -(Math.random() * 2 + 1) * cellSize });
        }
        // Ensure all non-null gems have valid visual state
        if (grid[r][c] && grid[r][c].type !== null) {
          if (cellVisual[r][c].scale <= 0) cellVisual[r][c].scale = 1;
          if (cellVisual[r][c].alpha <= 0) cellVisual[r][c].alpha = 1;
        }
      }
    }

    return drops;
  }

  // ======== GAME STATE CHECKS ========

  function checkGameState() {
    let won = false;

    if (objectives) {
      switch (objectives.type) {
        case 'score':
          won = score >= targetScore;
          break;
        case 'collect':
          won = objectives.items.every(item => (collectProgress[item.gemType] || 0) >= item.count);
          break;
        case 'clear':
          won = !hasObstaclesRemaining();
          break;
        case 'boss':
          won = bossHp <= 0;
          break;
        default:
          won = score >= targetScore;
      }
    } else {
      won = score >= targetScore;
    }

    if (won) {
      phase = 'gameover';
      Audio.playLevelUp();
      const cw = canvas ? canvas.width : 300;
      const ch = canvas ? canvas.height : 300;
      for (let i = 0; i < Gems.COUNT; i++) {
        spawnParticles(
          cw / 2 + (Math.random() - 0.5) * 100,
          ch / 2 + (Math.random() - 0.5) * 100,
          i, 12
        );
      }
      setTimeout(() => { if (onLevelComplete) onLevelComplete(getState()); }, 600);
    } else if (timeLeft === -1 && movesLeft <= 0) {
      phase = 'gameover';
      Audio.playFail();
      setTimeout(() => { if (onLevelFail) onLevelFail(getState()); }, 400);
    } else if (timeLeft !== -1 && timeLeft <= 0) {
      phase = 'gameover';
      // Time attack ends with celebration (not fail) — fire level complete
      Audio.playLevelUp();
      setTimeout(() => { if (onLevelComplete) onLevelComplete(getState()); }, 600);
    }
  }

  function hasObstaclesRemaining() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] && grid[r][c].obstacle && grid[r][c].obstacle.id !== 'stone') return true;
      }
    }
    return false;
  }

  // ======== POTION EFFECTS ========

  function usePotion(potionType) {
    if (phase !== 'idle') return false;

    switch (potionType) {
      case 'shuffle':
        reshuffleBoard();
        return true;
      case 'time':
        if (timeLeft > 0) { timeLeft += 15; return true; }
        // On non-timed levels, frost potion grants +3 extra moves instead
        if (timeLeft === -1) { movesLeft += 3; if (onScoreChange) onScoreChange(getState()); return true; }
        return false;
      case 'bomb': {
        phase = 'animating';
        const cr = Math.floor(rows / 2), cc = Math.floor(cols / 2);
        const cells = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = cr + dr, nc = cc + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc]) {
              cells.push({ row: nr, col: nc });
            }
          }
        }
        shakeAmount = 10;
        const clearAnim = new ClearAnim(cells, 0.3, () => {
          cells.forEach(c => { grid[c.row][c.col] = null; });
          const drops = dropAndFill();
          if (drops.length > 0) {
            animations.push(new DropAnim(drops, 0.3, () => {
              combo = 0;
              processMatchChain();
            }));
          } else {
            combo = 0;
            processMatchChain();
          }
        });
        animations.push(clearAnim);
        return true;
      }
      case 'rainbow': {
        phase = 'animating';
        const randomType = Math.floor(Math.random() * Gems.COUNT);
        const rainbowCells = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (grid[r][c] && grid[r][c].type === randomType) {
              rainbowCells.push({ row: r, col: c });
            }
          }
        }
        score += rainbowCells.length * 20;
        shakeAmount = 12;
        const rainbowAnim = new ClearAnim(rainbowCells, 0.3, () => {
          rainbowCells.forEach(c => { grid[c.row][c.col] = null; });
          const drops = dropAndFill();
          if (drops.length > 0) {
            animations.push(new DropAnim(drops, 0.3, () => {
              combo = 0;
              processMatchChain();
            }));
          } else {
            combo = 0;
            processMatchChain();
          }
        });
        animations.push(rainbowAnim);
        return true;
      }
      case 'shadow': {
        phase = 'animating';
        const candidates = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (grid[r][c] && grid[r][c].type !== null && !(grid[r][c].obstacle && grid[r][c].obstacle.id === 'stone')) {
              candidates.push({ row: r, col: c });
            }
          }
        }
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const shadowCells = candidates.slice(0, Math.min(5, candidates.length));
        score += shadowCells.length * 15;
        shakeAmount = 6;
        const shadowAnim = new ClearAnim(shadowCells, 0.3, () => {
          shadowCells.forEach(c => { grid[c.row][c.col] = null; });
          const drops = dropAndFill();
          if (drops.length > 0) {
            animations.push(new DropAnim(drops, 0.3, () => {
              combo = 0;
              processMatchChain();
            }));
          } else {
            combo = 0;
            processMatchChain();
          }
        });
        animations.push(shadowAnim);
        return true;
      }
    }
    return false;
  }

  // ======== ANIMATION CLASSES ========

  class SwapAnim {
    constructor(r1, c1, r2, c2, duration, onDone) {
      this.r1 = r1; this.c1 = c1; this.r2 = r2; this.c2 = c2;
      this.duration = duration; this.elapsed = 0; this.onDone = onDone;
      this.sx1 = c1 * cellSize + padding; this.sy1 = r1 * cellSize + padding;
      this.sx2 = c2 * cellSize + padding; this.sy2 = r2 * cellSize + padding;
    }
    update(dt) {
      this.elapsed += dt;
      let t = Math.min(1, this.elapsed / this.duration);
      t = t < 0.5 ? 2 * t * t : (1 - Math.pow(-2 * t + 2, 2) / 2);
      if (cellVisual[this.r1] && cellVisual[this.r1][this.c1]) {
        cellVisual[this.r1][this.c1].x = this.sx1 + (this.sx2 - this.sx1) * t;
        cellVisual[this.r1][this.c1].y = this.sy1 + (this.sy2 - this.sy1) * t;
      }
      if (cellVisual[this.r2] && cellVisual[this.r2][this.c2]) {
        cellVisual[this.r2][this.c2].x = this.sx2 + (this.sx1 - this.sx2) * t;
        cellVisual[this.r2][this.c2].y = this.sy2 + (this.sy1 - this.sy2) * t;
      }
      if (this.elapsed >= this.duration) {
        try {
          if (this.onDone) this.onDone();
        } catch (e) {
          console.error('[AzerothMatch] SwapAnim callback error:', e);
          try { validateAndRepairBoard(); } catch (e2) {}
          phase = 'idle';
          selected = null;
        }
        return false;
      }
      return true;
    }
  }

  class ClearAnim {
    constructor(cells, duration, onDone) {
      this.cells = cells.filter(c => c && c.row >= 0 && c.row < rows && c.col >= 0 && c.col < cols);
      this.duration = duration; this.elapsed = 0;
      this.onDone = onDone; this.particlesSpawned = false;
      this.flashAlpha = 1.0;
    }
    update(dt) {
      this.elapsed += dt;
      const t = Math.min(1, this.elapsed / this.duration);
      if (!this.particlesSpawned) {
        this.particlesSpawned = true;
        this.cells.forEach(({ row, col }) => {
          try {
            const v = cellVisual[row] && cellVisual[row][col];
            if (v && grid[row] && grid[row][col] && grid[row][col].type !== null) {
              spawnParticles(v.x + cellSize / 2, v.y + cellSize / 2, grid[row][col].type, 10);
            }
          } catch (e) { /* skip particle on error */ }
        });
      }
      // Flash effect stored for render phase (no ctx operations here)
      this.flashAlpha = Math.max(0, 1.0 - t * 3);
      this.cells.forEach(({ row, col }) => {
        if (cellVisual[row] && cellVisual[row][col]) {
          cellVisual[row][col].scale = 1 - t;
          cellVisual[row][col].alpha = 1 - t * 0.8;
        }
      });
      if (this.elapsed >= this.duration) {
        this.cells.forEach(({ row, col }) => {
          if (cellVisual[row] && cellVisual[row][col]) {
            cellVisual[row][col].scale = 1;
            cellVisual[row][col].alpha = 1;
          }
        });
        try {
          if (this.onDone) this.onDone();
        } catch (e) {
          console.error('[AzerothMatch] ClearAnim callback error:', e);
          // Emergency: force recover
          try { validateAndRepairBoard(); } catch (e2) {}
          phase = 'idle';
        }
        return false;
      }
      return true;
    }
  }

  class DropAnim {
    constructor(drops, duration, onDone) {
      this.drops = drops.filter(d => d && d.row >= 0 && d.row < rows && d.col >= 0 && d.col < cols);
      this.duration = duration; this.elapsed = 0; this.onDone = onDone;
      // bounce phase runs after drop lands
      this.bounceElapsed = 0;
      this.bounceDuration = 0.18;
      this.landed = false;
    }
    update(dt) {
      if (!this.landed) {
        this.elapsed += dt;
        let t = Math.min(1, this.elapsed / this.duration);
        t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.drops.forEach(d => {
          if (cellVisual[d.row] && cellVisual[d.row][d.col]) {
            const targetY = d.row * cellSize + padding;
            cellVisual[d.row][d.col].y = d.fromY + (targetY - d.fromY) * t;
          }
        });
        if (this.elapsed >= this.duration) {
          this.landed = true;
          // snap to grid
          this.drops.forEach(d => {
            if (cellVisual[d.row] && cellVisual[d.row][d.col]) {
              cellVisual[d.row][d.col].x = d.col * cellSize + padding;
              cellVisual[d.row][d.col].y = d.row * cellSize + padding;
              cellVisual[d.row][d.col].scale = 1;
              cellVisual[d.row][d.col].alpha = 1;
            }
          });
        }
        return true;
      }

      // Bounce phase: quick squash-and-stretch after landing
      if (!prefersReducedMotion) {
        this.bounceElapsed += dt;
        const bt = Math.min(1, this.bounceElapsed / this.bounceDuration);
        // Squash then stretch: scale goes 0.85 → 1.1 → 1.0
        let bounceScale;
        if (bt < 0.4) {
          bounceScale = 1.0 - 0.15 * (bt / 0.4);
        } else if (bt < 0.7) {
          bounceScale = 0.85 + 0.25 * ((bt - 0.4) / 0.3);
        } else {
          bounceScale = 1.1 - 0.1 * ((bt - 0.7) / 0.3);
        }
        this.drops.forEach(d => {
          if (cellVisual[d.row] && cellVisual[d.row][d.col]) {
            cellVisual[d.row][d.col].scale = bounceScale;
          }
        });
        if (this.bounceElapsed < this.bounceDuration) return true;
        // reset scale to 1 after bounce
        this.drops.forEach(d => {
          if (cellVisual[d.row] && cellVisual[d.row][d.col]) {
            cellVisual[d.row][d.col].scale = 1;
          }
        });
      }

      try {
        if (this.onDone) this.onDone();
      } catch (e) {
        console.error('[AzerothMatch] DropAnim callback error:', e);
        try { validateAndRepairBoard(); } catch (e2) {}
        phase = 'idle';
      }
      return false;
    }
  }

  function resetVisual(r, c) {
    if (!cellVisual[r]) cellVisual[r] = [];
    cellVisual[r][c] = {
      x: c * cellSize + padding,
      y: r * cellSize + padding,
      scale: 1,
      alpha: 1
    };
  }

  // ======== PARTICLES ========

  const MAX_PARTICLES = 200;

  function spawnParticles(cx, cy, gemType, count) {
    if (particles.length >= MAX_PARTICLES) return;
    const g = Gems.TYPES[gemType] || Gems.TYPES[0];
    const spawnCount = Math.min(count, MAX_PARTICLES - particles.length);
    for (let i = 0; i < spawnCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        r: 2 + Math.random() * 3,
        color: Math.random() > 0.5 ? g.c1 : g.c2,
        alpha: 1, life: 0, maxLife: 0.4 + Math.random() * 0.4,
        gravity: 300 + Math.random() * 200,
        type: Math.random() > 0.6 ? 'star' : 'circle'
      });
    }
  }

  function spawnFloatText(x, y, text, color, sizeScale) {
    const ss = sizeScale || 1.0;
    floatTexts.push({
      x, y, text, color: color || '#FFD700',
      alpha: 1, life: 0, maxLife: 0.9 + ss * 0.2,
      scale: 0.2, targetScale: 1.1 * ss, vy: -70 * ss,
      sizeScale: ss
    });
  }

  // ======== INPUT ========

  let lastTouchTime = 0;

  function setupInput() {
    if (!canvas) return;

    canvas.addEventListener('mousedown', e => {
      if (Date.now() - lastTouchTime < 500) return;
      Audio.init();
      clearHint();
      const cell = getCellFromXY(e.clientX, e.clientY);
      if (cell) handleCellClick(cell);
    });

    // Feature 5: Mouse move for hover preview
    canvas.addEventListener('mousemove', e => {
      if (Date.now() - lastTouchTime < 500) return;
      if (phase !== 'idle') return;
      const cell = getCellFromXY(e.clientX, e.clientY);
      hoverCell = cell;
      updateMovePreview();
    });

    canvas.addEventListener('mouseleave', () => {
      hoverCell = null;
      previewSwapGhost = null;
    });

    canvas.addEventListener('touchstart', e => {
      lastTouchTime = Date.now();
      e.preventDefault();
      // Ignore multi-touch
      if (e.touches.length > 1) return;
      Audio.init();
      clearHint();
      if (phase !== 'idle') return;
      const touch = e.touches[0];
      const cell = getCellFromXY(touch.clientX, touch.clientY);
      if (cell) {
        const gem = grid[cell.row] && grid[cell.row][cell.col];
        if (!gem || (gem.obstacle && gem.obstacle.id === 'stone')) return;
        touchStart = cell;
        if (!selected) {
          selected = cell;
          Audio.playSelect();
        }
        // Feature 5: set hover for touch
        hoverCell = cell;
        updateMovePreview();
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      // Feature 5: update hover during touch drag
      if (phase !== 'idle' || !selected) return;
      const touch = e.touches[0];
      const cell = getCellFromXY(touch.clientX, touch.clientY);
      if (cell && (!hoverCell || cell.row !== hoverCell.row || cell.col !== hoverCell.col)) {
        hoverCell = cell;
        updateMovePreview();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (!touchStart) return;
      // Always clear touchStart to prevent stuck state
      const startRef = touchStart;
      touchStart = null;
      hoverCell = null;
      previewSwapGhost = null;
      if (phase !== 'idle') return;
      const touch = e.changedTouches[0];
      const cell = getCellFromXY(touch.clientX, touch.clientY);
      if (cell) {
        if (selected && isAdjacent(selected, cell)) {
          handleMove(selected, cell);
        } else {
          selected = cell;
          Audio.playSelect();
        }
      }
    }, { passive: false });
  }

  function getCellFromXY(clientX, clientY) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const col = Math.floor((x - padding) / cellSize);
    const row = Math.floor((y - padding) / cellSize);
    if (row >= 0 && row < rows && col >= 0 && col < cols) return { row, col };
    return null;
  }

  function isAdjacent(a, b) {
    return (Math.abs(a.row - b.row) === 1 && a.col === b.col) ||
           (a.row === b.row && Math.abs(a.col - b.col) === 1);
  }

  function handleCellClick(cell) {
    if (phase !== 'idle') return;
    const gem = grid[cell.row][cell.col];
    if (!gem || (gem.obstacle && gem.obstacle.id === 'stone')) return;

    if (!selected) {
      selected = cell;
      Audio.playSelect();
    } else if (selected.row === cell.row && selected.col === cell.col) {
      selected = null;
      previewSwapGhost = null;
    } else if (isAdjacent(selected, cell)) {
      handleMove(selected, cell);
    } else {
      selected = cell;
      Audio.playSelect();
    }
  }

  // ======== RENDER ========

  let cachedBgGrad = null;
  let cachedBgW = 0;
  let cachedBgH = 0;
  let cachedWeatherPhase = '';

  function render(timestamp) {
    if (!ctx || !canvas) return;
    const w = canvas.width, h = canvas.height;

    // Feature 2: Update weather phase and apply CSS class to body
    const prevWeatherPhase = weatherPhase;
    weatherPhase = getWeatherPhase();
    if (weatherPhase !== prevWeatherPhase) {
      document.body.classList.remove('weather-dawn', 'weather-day', 'weather-sunset', 'weather-night');
      document.body.classList.add('weather-' + weatherPhase);
    }

    ctx.save();

    // Shake
    if (shakeAmount > 0.5 && !prefersReducedMotion) {
      ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
      shakeAmount *= shakeDecay;
    } else {
      shakeAmount = 0;
    }

    // Feature 2: Weather-based background gradient
    const weatherColors = getWeatherColors(weatherPhase);
    if (!cachedBgGrad || cachedBgW !== w || cachedBgH !== h || cachedWeatherPhase !== weatherPhase) {
      cachedBgGrad = ctx.createLinearGradient(0, 0, 0, h);
      cachedBgGrad.addColorStop(0, weatherColors.top);
      cachedBgGrad.addColorStop(1, weatherColors.bottom);
      cachedBgW = w;
      cachedBgH = h;
      cachedWeatherPhase = weatherPhase;
    }
    ctx.fillStyle = cachedBgGrad;
    roundRect(ctx, 0, 0, w, h, 16);
    ctx.fill();

    // Feature 2: Weather tint overlay
    ctx.fillStyle = weatherColors.tint;
    roundRect(ctx, 0, 0, w, h, 16);
    ctx.fill();

    // Decorative board frame with golden border
    ctx.save();
    ctx.strokeStyle = 'rgba(201,168,76,0.25)';
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, w - 2, h - 2, 15);
    ctx.stroke();
    // Inner subtle glow line
    ctx.strokeStyle = 'rgba(201,168,76,0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, 3, 3, w - 6, h - 6, 13);
    ctx.stroke();
    ctx.restore();

    // Corner decorations
    if (!prefersReducedMotion) {
      ctx.save();
      const cornerGlow = 0.12 + 0.05 * Math.sin((timestamp || 0) * 0.002);
      ctx.globalAlpha = cornerGlow;
      const cornerR = 20;
      // Top-left
      const cGrad1 = ctx.createRadialGradient(0, 0, 0, 0, 0, cornerR);
      cGrad1.addColorStop(0, 'rgba(201,168,76,0.6)');
      cGrad1.addColorStop(1, 'rgba(201,168,76,0)');
      ctx.fillStyle = cGrad1;
      ctx.fillRect(0, 0, cornerR, cornerR);
      // Top-right
      const cGrad2 = ctx.createRadialGradient(w, 0, 0, w, 0, cornerR);
      cGrad2.addColorStop(0, 'rgba(201,168,76,0.6)');
      cGrad2.addColorStop(1, 'rgba(201,168,76,0)');
      ctx.fillStyle = cGrad2;
      ctx.fillRect(w - cornerR, 0, cornerR, cornerR);
      // Bottom-left
      const cGrad3 = ctx.createRadialGradient(0, h, 0, 0, h, cornerR);
      cGrad3.addColorStop(0, 'rgba(201,168,76,0.6)');
      cGrad3.addColorStop(1, 'rgba(201,168,76,0)');
      ctx.fillStyle = cGrad3;
      ctx.fillRect(0, h - cornerR, cornerR, cornerR);
      // Bottom-right
      const cGrad4 = ctx.createRadialGradient(w, h, 0, w, h, cornerR);
      cGrad4.addColorStop(0, 'rgba(201,168,76,0.6)');
      cGrad4.addColorStop(1, 'rgba(201,168,76,0)');
      ctx.fillStyle = cGrad4;
      ctx.fillRect(w - cornerR, h - cornerR, cornerR, cornerR);
      ctx.restore();
    }

    // Feature 2: Night stars
    if (weatherPhase === 'night' && !prefersReducedMotion) {
      ctx.save();
      for (let i = 0; i < 12; i++) {
        const sx = ((i * 37 + 13) % w);
        const sy = ((i * 23 + 7) % (h * 0.4));
        const twinkle = 0.2 + 0.3 * Math.abs(Math.sin((timestamp || 0) * 0.001 + i * 1.7));
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(sx, sy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Feature 2: Weather particles behind gems
    renderWeatherParticles(ctx);

    // Grid cell backgrounds with subtle inner glow
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellSize + padding;
        const y = r * cellSize + padding;
        const isLight = (r + c) % 2 === 0;
        ctx.fillStyle = isLight ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)';
        roundRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, 8);
        ctx.fill();
        // Subtle inner border for depth
        ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 0.5;
        roundRect(ctx, x + 1.5, y + 1.5, cellSize - 3, cellSize - 3, 7);
        ctx.stroke();
      }
    }

    // Draw gems
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] && grid[r][c].type !== null) {
          const v = cellVisual[r][c];
          Gems.drawGem(ctx, v.x, v.y, cellSize, grid[r][c], v.scale, v.alpha, timestamp);
        }
      }
    }

    // Feature 2: Rain glisten effect on top of gems
    renderRainGlisten(ctx, timestamp);

    // Feature 5: Valid swap targets glow
    renderValidTargets(ctx, timestamp);

    // Feature 5: Move preview ghost
    renderMovePreview(ctx, timestamp);

    // Selection indicator
    if (selected && phase === 'idle') {
      drawSelection(ctx, selected, timestamp);
    }

    // Feature 1: Hint overlay
    renderHintOverlay(ctx, timestamp);

    // Particles
    renderParticles(ctx);
    renderFloatTexts(ctx);

    // Boss HP bar (if boss level)
    if (bossMaxHp > 0) {
      renderBossBar(ctx, w);
    }

    // Feature 3: Rhythm indicator
    renderRhythmIndicator(ctx, timestamp, w, h);

    ctx.restore();
  }

  function drawSelection(ctx, sel, t) {
    const x = sel.col * cellSize + padding;
    const y = sel.row * cellSize + padding;
    const pulse = 0.5 + 0.5 * Math.sin((t || 0) * 0.005);
    const margin = cellSize * 0.02;
    const tileW = cellSize - margin * 2;
    const cr = tileW * 0.14;

    ctx.save();
    // Outer glow
    ctx.strokeStyle = `rgba(255,215,0,${0.15 + 0.1 * pulse})`;
    ctx.lineWidth = 6;
    roundRect(ctx, x + margin - 2, y + margin - 2, tileW + 4, tileW + 4, cr + 2);
    ctx.stroke();
    // Inner dashed border
    ctx.strokeStyle = `rgba(255,215,0,${0.6 + 0.3 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -(t || 0) * 0.02;
    roundRect(ctx, x + margin, y + margin, tileW, tileW, cr);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function renderBossBar(ctx, canvasW) {
    const barW = canvasW - 20;
    const barH = 12;
    const x = 10, y = 4;
    const pct = bossMaxHp > 0 ? bossHp / bossMaxHp : 0;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, x, y, barW, barH, 6);
    ctx.fill();
    const hpGrad = ctx.createLinearGradient(x, 0, x + barW * pct, 0);
    hpGrad.addColorStop(0, '#FF4444');
    hpGrad.addColorStop(1, '#FF8800');
    ctx.fillStyle = hpGrad;
    roundRect(ctx, x, y, barW * pct, barH, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`BOSS: ${bossHp}/${bossMaxHp}`, canvasW / 2, y + barH - 2);
    ctx.restore();
  }

  function renderParticles(ctx) {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      if (p.type === 'star') {
        drawStar(ctx, p.x, p.y, p.r);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawStar(ctx, x, y, r) {
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

  function renderFloatTexts(ctx) {
    floatTexts.forEach(f => {
      ctx.save();
      ctx.globalAlpha = f.alpha;
      const baseFontSize = 18 * (f.sizeScale || 1.0);
      ctx.font = `bold ${Math.round(baseFontSize * f.scale)}px 'Segoe UI',system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (f.sizeScale && f.sizeScale >= 1.4) {
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText(f.text, f.x, f.y);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillText(f.text, f.x + 1, f.y + 1);
      }
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  // ======== GAME LOOP ========

  let lastTime = 0;

  function update(timestamp) {
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    // Update animations (with per-animation error protection)
    for (let i = animations.length - 1; i >= 0; i--) {
      try {
        if (!animations[i].update(dt)) animations.splice(i, 1);
      } catch (e) {
        console.error('[AzerothMatch] Animation error, removing broken animation:', e);
        animations.splice(i, 1);
        // If this was the last animation and we're still animating, recover
        if (animations.length === 0 && phase === 'animating') {
          phase = 'idle';
          validateAndRepairBoard();
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = 1 - (p.life / p.maxLife);
      p.r *= 0.995;
    }

    // Float texts
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const f = floatTexts[i];
      f.life += dt;
      if (f.life >= f.maxLife) { floatTexts.splice(i, 1); continue; }
      const t = f.life / f.maxLife;
      f.y += f.vy * dt;
      f.alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
      f.scale += (f.targetScale - f.scale) * 0.15;
      if (t > 0.3) f.targetScale = 0.9;
    }

    // Skip non-essential updates when paused
    if (phase === 'paused') {
      render(timestamp);
      return;
    }

    // Time-based levels
    if (timeLeft > 0 && phase === 'idle') {
      const prevSecond = Math.ceil(timeLeft);
      timeLeft -= dt;
      const newSecond = Math.ceil(timeLeft);
      if (prevSecond !== newSecond && onScoreChange) {
        try { onScoreChange(getState()); } catch (e) {}
      }
      if (timeLeft <= 0) {
        timeLeft = 0;
        checkGameState();
      }
    }

    // Stuck-phase detection: if animating with no animations for too long, recover
    if (phase === 'animating' && animations.length === 0) {
      stuckTimer += dt;
      if (stuckTimer > STUCK_TIMEOUT) {
        console.warn('[AzerothMatch] Phase stuck at animating with no animations — auto-recovering');
        phase = 'idle';
        validateAndRepairBoard();
        stuckTimer = 0;
        if (onMoveComplete) {
          try { onMoveComplete(getState()); } catch (e) {}
        }
      }
    } else {
      stuckTimer = 0;
    }

    // Feature 1: Hint system
    updateHintSystem(dt);

    // Feature 2: Weather particles
    updateWeatherParticles(dt);

    // Feature 3: Rhythm system
    updateRhythmSystem(dt);

    render(timestamp);
  }

  let rafHandle = null;
  let stuckTimer = 0;       // tracks how long phase='animating' with empty queue
  const STUCK_TIMEOUT = 3.0; // seconds before auto-recovery

  function startLoop() {
    if (rafHandle) cancelAnimationFrame(rafHandle);
    lastTime = performance.now();
    stuckTimer = 0;
    function loop(ts) {
      try {
        update(ts);
      } catch (e) {
        console.error('[AzerothMatch] Game loop error:', e);
        // Emergency recovery — never let the game freeze
        try {
          animations = [];
          if (phase === 'animating') {
            phase = 'idle';
            validateAndRepairBoard();
          }
        } catch (recoveryErr) {
          console.error('[AzerothMatch] Recovery also failed:', recoveryErr);
          phase = 'idle';
          animations = [];
        }
      }
      rafHandle = requestAnimationFrame(loop);
    }
    rafHandle = requestAnimationFrame(loop);
  }

  // ======== STATE GETTERS ========

  function getState() {
    return {
      score, combo, movesLeft, timeLeft, targetScore,
      bossHp, bossMaxHp,
      phase,
      objectives,
      collectProgress,
      rows, cols,
      rhythmMultiplier,
      rhythmStreak,
      weatherPhase
    };
  }

  function setCallbacks(cbs) {
    if (cbs.onMoveComplete) onMoveComplete = cbs.onMoveComplete;
    if (cbs.onLevelComplete) onLevelComplete = cbs.onLevelComplete;
    if (cbs.onLevelFail) onLevelFail = cbs.onLevelFail;
    if (cbs.onScoreChange) onScoreChange = cbs.onScoreChange;
    if (cbs.onCombo) onCombo = cbs.onCombo;
  }

  function getScore() { return score; }
  function getCombo() { return combo; }

  return {
    init,
    startLevel,
    startLoop,
    update,
    render,
    getState,
    getScore,
    getCombo,
    setCallbacks,
    usePotion,
    updateCanvasSize,
    get phase() { return phase; },
    set phase(v) { phase = v; }
  };
})();
