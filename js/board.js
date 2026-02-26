/**
 * board.js — 核心match-3引擎
 * 网格管理、匹配检测、级联消除、重力、动画
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

  // ======== INITIALIZATION ========

  function init(canvasEl, config) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    if (config) applyConfig(config);
    setupInput();
  }

  function applyConfig(config) {
    levelConfig = config;
    rows = config.rows || 8;
    cols = config.cols || 8;
    targetScore = config.targetScore || 500;
    movesLeft = config.moves || 25;
    timeLeft = config.timeLimit || -1;
    objectives = config.objectives || null;
    bossHp = config.bossHp || 0;
    bossMaxHp = bossHp;
    collectProgress = {};
    if (objectives && objectives.type === 'collect') {
      objectives.items.forEach(item => { collectProgress[item.gemType] = 0; });
    }
  }

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
    if (!container) return;
    const maxW = container.clientWidth - 16;
    cellSize = Math.floor(Math.min(52, (maxW - padding * 2) / cols));
    cellSize = Math.max(40, cellSize); // minimum 40px
    const w = cols * cellSize + padding * 2;
    const h = rows * cellSize + padding * 2;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    initCellVisual();
  }

  // ======== MATCH DETECTION ========

  function findMatches() {
    const matched = [];

    // Horizontal matches
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
    const merged = [];

    groups.forEach(group => {
      group.forEach(cell => {
        const key = `${cell.row},${cell.col}`;
        if (!cellMap[key]) cellMap[key] = cell;
      });
    });

    // For special gem detection, keep groups separate but merge overlapping
    // Return as flat array of unique cells for simplicity
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

  // ======== SWAP & MOVE ========

  function swapGridData(r1, c1, r2, c2) {
    const temp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = temp;
  }

  function handleMove(cell1, cell2) {
    if (phase !== 'idle') return;
    phase = 'animating';
    Audio.playSwap();

    swapGridData(cell1.row, cell1.col, cell2.row, cell2.col);

    const anim = new SwapAnim(cell1.row, cell1.col, cell2.row, cell2.col, 0.2, () => {
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
      if (onScoreChange) onScoreChange(getState());
    });
    animations.push(anim);
  }

  // ======== MATCH CHAIN PROCESSING ========

  function processMatchChain() {
    const matchGroups = findMatchGroups();
    const allMatches = findMatches();

    if (allMatches.length === 0) {
      // Check for no valid moves → reshuffle
      if (!hasValidMoves() && phase !== 'gameover') {
        reshuffleBoard();
      }
      checkGameState();
      if (phase !== 'gameover') phase = 'idle';
      if (onMoveComplete) onMoveComplete(getState());
      return;
    }

    combo++;
    // 按最常见宝石类型播放对应音高
    const matchTypes = allMatches.map(c => grid[c.row] && grid[c.row][c.col] ? grid[c.row][c.col].type : 0).filter(t => t !== null && t !== undefined);
    const mainGemType = matchTypes.length > 0 ? matchTypes[0] : 0;
    Audio.playMatch(mainGemType);
    if (combo >= 2) Audio.playCombo(combo);

    // Score calculation
    const baseScore = allMatches.length * 15;
    const comboBonus = combo > 1 ? combo * 8 : 0;
    score += baseScore + comboBonus;

    // Track gem collection for objectives
    allMatches.forEach(cell => {
      const gem = grid[cell.row][cell.col];
      if (gem && gem.type !== null) {
        const typeId = Gems.TYPES[gem.type].id;
        if (collectProgress[typeId] !== undefined) collectProgress[typeId]++;
        // Add potion ingredients
        const data = Storage.get();
        const ingredientMap = ['arcane', 'fel', 'frost', 'fire', 'shadow', 'nature', 'holy'];
        const ingr = ingredientMap[gem.type] || 'arcane';
        data.potions.ingredients[ingr] = (data.potions.ingredients[ingr] || 0) + 1;
        data.stats.totalGems++;
      }
    });

    // Boss damage
    if (bossHp > 0) {
      const dmg = allMatches.length * 2 + (combo > 1 ? combo * 3 : 0);
      bossHp = Math.max(0, bossHp - dmg);
    }

    // Check for special gem creation
    matchGroups.forEach(group => {
      const special = Gems.getSpecialFromMatch(group.cells, group.dir);
      if (special && group.cells.length > 0) {
        // Place special gem at the center of the match
        const center = group.cells[Math.floor(group.cells.length / 2)];
        // Mark this cell to become special after clearing
        center._becomeSpecial = { special, type: group.type };
      }
    });

    // Process special gem activations
    const extraClears = [];
    allMatches.forEach(cell => {
      const gem = grid[cell.row][cell.col];
      if (gem && gem.special) {
        const activated = activateSpecial(gem, cell.row, cell.col);
        activated.forEach(ac => {
          if (!allMatches.find(m => m.row === ac.row && m.col === ac.col)) {
            extraClears.push(ac);
          }
        });
      }
    });

    const allClears = [...allMatches, ...extraClears];

    // Combo text — 3连击起显示 COMBO 样式
    if (combo >= 2) {
      const mx = allClears.reduce((s, m) => s + m.col, 0) / allClears.length * cellSize + padding + cellSize / 2;
      const my = allClears.reduce((s, m) => s + m.row, 0) / allClears.length * cellSize + padding;
      if (combo >= 5) {
        spawnFloatText(mx, my - 10, `MEGA COMBO x${combo}!! 💥`, '#FF4500', 2.0);
        shakeAmount = 8 + combo * 2;
      } else if (combo >= 3) {
        spawnFloatText(mx, my - 5, `COMBO x${combo}! 🔥`, '#FF8C00', 1.5);
        shakeAmount = 5 + combo * 1.5;
      } else {
        spawnFloatText(mx, my, `${combo}连击! ✨`, '#FFD700', 1.1);
        shakeAmount = 3 + combo * 2;
      }
    }

    // Score text
    {
      const mx = allClears.reduce((s, m) => s + m.col, 0) / allClears.length * cellSize + padding + cellSize / 2;
      const my = allClears.reduce((s, m) => s + m.row, 0) / allClears.length * cellSize + padding + cellSize / 2;
      spawnFloatText(mx, my - 15, `+${baseScore + comboBonus}`, '#FF6B8A');
    }

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
        if (cell._becomeSpecial) {
          grid[cell.row][cell.col] = Gems.createGem(cell._becomeSpecial.type);
          grid[cell.row][cell.col].special = cell._becomeSpecial.special;
          // Don't null this cell
          cellVisual[cell.row][cell.col].scale = 1;
          cellVisual[cell.row][cell.col].alpha = 1;
        } else {
          const gem = grid[cell.row][cell.col];
          if (gem && !(gem.obstacle && gem.obstacle.id === 'stone')) {
            grid[cell.row][cell.col] = null;
          }
        }
      });

      const drops = dropAndFill();
      if (drops.length > 0) {
        animations.push(new DropAnim(drops, 0.3, () => processMatchChain()));
      } else {
        processMatchChain();
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
      case 'rainbow':
        // Clear all gems of the same type
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

    // Spawn particles for special activation
    cells.forEach(cell => {
      const v = cellVisual[cell.row][cell.col];
      if (grid[cell.row][cell.col]) {
        spawnParticles(v.x + cellSize / 2, v.y + cellSize / 2, grid[cell.row][cell.col].type || 0, 6);
      }
    });

    return cells;
  }

  function reshuffleBoard() {
    // Collect all gem types
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

    // Reassign
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] && grid[r][c].type !== null && !grid[r][c].obstacle) {
          grid[r][c].type = gemTypes[idx++];
        }
      }
    }

    // Show reshuffle text
    spawnFloatText(canvas.width / 2, canvas.height / 2, '🔄 重新排列!', '#FFD700');
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
            drops.push({ row: emptyRow, col: c, fromY });
          }
          emptyRow--;
        } else if (cell && cell.obstacle && cell.obstacle.id === 'stone') {
          // Stone is immovable, skip
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

    return drops;
  }

  // ======== GAME STATE CHECKS ========

  function checkGameState() {
    // Check win conditions
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
      // Celebration particles
      for (let i = 0; i < Gems.COUNT; i++) {
        spawnParticles(
          canvas.width / 2 + (Math.random() - 0.5) * 100,
          canvas.height / 2 + (Math.random() - 0.5) * 100,
          i, 12
        );
      }
      setTimeout(() => { if (onLevelComplete) onLevelComplete(getState()); }, 600);
    } else if (movesLeft <= 0 && timeLeft <= 0 && timeLeft !== -1) {
      phase = 'gameover';
      Audio.playFail();
      setTimeout(() => { if (onLevelFail) onLevelFail(getState()); }, 400);
    } else if (movesLeft <= 0 && timeLeft === -1) {
      phase = 'gameover';
      Audio.playFail();
      setTimeout(() => { if (onLevelFail) onLevelFail(getState()); }, 400);
    }
  }

  function hasObstaclesRemaining() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] && grid[r][c].obstacle) return true;
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
        if (timeLeft > 0) timeLeft += 15;
        return true;
      case 'bomb':
        // Clear center 3x3
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
            phase = 'idle';
          }
        });
        animations.push(clearAnim);
        return true;
      case 'rainbow':
        // Clear all of a random gem type
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
            phase = 'idle';
          }
        });
        animations.push(rainbowAnim);
        return true;
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
      cellVisual[this.r1][this.c1].x = this.sx1 + (this.sx2 - this.sx1) * t;
      cellVisual[this.r1][this.c1].y = this.sy1 + (this.sy2 - this.sy1) * t;
      cellVisual[this.r2][this.c2].x = this.sx2 + (this.sx1 - this.sx2) * t;
      cellVisual[this.r2][this.c2].y = this.sy2 + (this.sy1 - this.sy2) * t;
      if (this.elapsed >= this.duration) {
        if (this.onDone) this.onDone();
        return false;
      }
      return true;
    }
  }

  class ClearAnim {
    constructor(cells, duration, onDone) {
      this.cells = cells; this.duration = duration; this.elapsed = 0;
      this.onDone = onDone; this.particlesSpawned = false;
    }
    update(dt) {
      this.elapsed += dt;
      const t = Math.min(1, this.elapsed / this.duration);
      if (!this.particlesSpawned) {
        this.particlesSpawned = true;
        this.cells.forEach(({ row, col }) => {
          const v = cellVisual[row][col];
          if (grid[row][col] && grid[row][col].type !== null) {
            spawnParticles(v.x + cellSize / 2, v.y + cellSize / 2, grid[row][col].type, 8);
          }
        });
      }
      this.cells.forEach(({ row, col }) => {
        cellVisual[row][col].scale = 1 - t;
        cellVisual[row][col].alpha = 1 - t * 0.8;
      });
      if (this.elapsed >= this.duration) {
        this.cells.forEach(({ row, col }) => {
          cellVisual[row][col].scale = 1;
          cellVisual[row][col].alpha = 1;
        });
        if (this.onDone) this.onDone();
        return false;
      }
      return true;
    }
  }

  class DropAnim {
    constructor(drops, duration, onDone) {
      this.drops = drops; this.duration = duration; this.elapsed = 0; this.onDone = onDone;
    }
    update(dt) {
      this.elapsed += dt;
      let t = Math.min(1, this.elapsed / this.duration);
      t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.drops.forEach(d => {
        const targetY = d.row * cellSize + padding;
        cellVisual[d.row][d.col].y = d.fromY + (targetY - d.fromY) * t;
      });
      if (this.elapsed >= this.duration) {
        this.drops.forEach(d => {
          cellVisual[d.row][d.col].y = d.row * cellSize + padding;
        });
        if (this.onDone) this.onDone();
        return false;
      }
      return true;
    }
  }

  function resetVisual(r, c) {
    cellVisual[r][c] = {
      x: c * cellSize + padding,
      y: r * cellSize + padding,
      scale: 1,
      alpha: 1
    };
  }

  // ======== PARTICLES ========

  function spawnParticles(cx, cy, gemType, count) {
    const g = Gems.TYPES[gemType] || Gems.TYPES[0];
    for (let i = 0; i < count; i++) {
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

  function setupInput() {
    if (!canvas) return;

    canvas.addEventListener('mousedown', e => {
      Audio.init();
      const cell = getCellFromXY(e.clientX, e.clientY);
      if (cell) handleCellClick(cell);
    });

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      Audio.init();
      if (phase !== 'idle') return;
      const touch = e.touches[0];
      const cell = getCellFromXY(touch.clientX, touch.clientY);
      if (cell) {
        touchStart = cell;
        if (!selected) {
          selected = cell;
          Audio.playSelect();
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (phase !== 'idle' || !touchStart) return;
      const touch = e.changedTouches[0];
      const cell = getCellFromXY(touch.clientX, touch.clientY);
      if (cell) {
        if (selected && isAdjacent(selected, cell)) {
          handleMove(selected, cell);
        } else if (cell) {
          selected = cell;
          Audio.playSelect();
        }
      }
      touchStart = null;
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
    } else if (isAdjacent(selected, cell)) {
      handleMove(selected, cell);
    } else {
      selected = cell;
      Audio.playSelect();
    }
  }

  // ======== RENDER ========

  function render(timestamp) {
    if (!ctx || !canvas) return;
    const w = canvas.width, h = canvas.height;

    ctx.save();

    // Shake
    if (shakeAmount > 0.5) {
      ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
      shakeAmount *= shakeDecay;
    } else {
      shakeAmount = 0;
    }

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0a0e1a');
    bgGrad.addColorStop(1, '#141828');
    ctx.fillStyle = bgGrad;
    roundRect(ctx, 0, 0, w, h, 16);
    ctx.fill();

    // Grid cell backgrounds
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellSize + padding;
        const y = r * cellSize + padding;
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
        roundRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, 8);
        ctx.fill();
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

    // Selection indicator
    if (selected && phase === 'idle') {
      drawSelection(ctx, selected, timestamp);
    }

    // Particles
    renderParticles(ctx);
    renderFloatTexts(ctx);

    // Boss HP bar (if boss level)
    if (bossMaxHp > 0) {
      renderBossBar(ctx, w);
    }

    ctx.restore();
  }

  function drawSelection(ctx, sel, t) {
    const x = sel.col * cellSize + padding;
    const y = sel.row * cellSize + padding;
    const pulse = 0.5 + 0.5 * Math.sin((t || 0) * 0.005);
    const cx = x + cellSize / 2, cy = y + cellSize / 2;
    const r = cellSize * 0.44;

    ctx.save();
    ctx.strokeStyle = `rgba(255,215,0,${0.5 + 0.3 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -(t || 0) * 0.02;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,215,0,${0.15 + 0.1 * pulse})`;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  }

  function renderBossBar(ctx, canvasW) {
    const barW = canvasW - 20;
    const barH = 12;
    const x = 10, y = 4;
    const pct = bossHp / bossMaxHp;

    ctx.save();
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, x, y, barW, barH, 6);
    ctx.fill();
    // HP bar
    const hpGrad = ctx.createLinearGradient(x, 0, x + barW * pct, 0);
    hpGrad.addColorStop(0, '#FF4444');
    hpGrad.addColorStop(1, '#FF8800');
    ctx.fillStyle = hpGrad;
    roundRect(ctx, x, y, barW * pct, barH, 6);
    ctx.fill();
    // Text
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
      // 大连击文字加白描边增强可读性
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

    // Update animations
    for (let i = animations.length - 1; i >= 0; i--) {
      if (!animations[i].update(dt)) animations.splice(i, 1);
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

    // Time-based levels
    if (timeLeft > 0 && phase === 'idle') {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        checkGameState();
      }
    }

    render(timestamp);
  }

  function startLoop() {
    lastTime = performance.now();
    function loop(ts) {
      update(ts);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ======== STATE GETTERS ========

  function getState() {
    return {
      score, combo, movesLeft, timeLeft, targetScore,
      bossHp, bossMaxHp,
      phase,
      objectives,
      collectProgress,
      rows, cols
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
