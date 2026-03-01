/**
 * app.js — 主应用控制器
 * 艾泽拉斯消消乐 — 页面路由、UI更新、系统集成
 */
'use strict';

const App = (() => {
  let currentPage = 'home';
  let selectedIsland = null;
  let selectedSeed = null;
  let selectedPlot = null;
  let dialogueQueue = [];
  let dialogueIndex = 0;
  let currentLevelConfig = null;
  let titleClickCount = 0;
  let currentStoryChapter = null;
  let gardenRefreshTimer = null;

  function init() {
    Storage.migrateV1();
    Storage.load();
    const data = Storage.get();

    Daily.updateStreak(data);
    Storage.save();

    Audio.setEnabled(data.settings.soundEnabled);

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) navigateTo(page);
      });
    });

    const soundBtn = document.getElementById('soundToggle');
    if (soundBtn) {
      soundBtn.textContent = Audio.isEnabled() ? '🔊' : '🔇';
      soundBtn.setAttribute('aria-checked', String(Audio.isEnabled()));
      soundBtn.addEventListener('click', () => {
        Audio.init();
        const enabled = !Audio.isEnabled();
        Audio.setEnabled(enabled);
        soundBtn.textContent = enabled ? '🔊' : '🔇';
        soundBtn.setAttribute('aria-checked', String(enabled));
        data.settings.soundEnabled = enabled;
        Storage.save();
      });
    }

    const canvas = document.getElementById('gameCanvas');
    if (canvas) Board.init(canvas);

    Board.setCallbacks({
      onScoreChange: (state) => {
        updateGameUI(state);
        if (state.combo >= 3) showComboFlash(state.combo);
        const movesEl = document.getElementById('gameMoves');
        if (movesEl) {
          if (state.timeLeft > 0 && state.timeLeft < 10) movesEl.classList.add('timer-urgent');
          else movesEl.classList.remove('timer-urgent');
        }
        updateRageMeterUI(state);
      },
      onLevelComplete: handleLevelComplete,
      onLevelFail: handleLevelFail,
      onMoveComplete: (state) => {
        const data = Storage.get();
        if (state.combo > data.stats.maxCombo) data.stats.maxCombo = state.combo;
        data.stats.totalMoves++;
        Storage.save();
      }
    });

    if (!data.tutorialDone) showTutorial();
    else navigateTo('home');

    const logo = document.querySelector('.logo');
    if (logo) {
      logo.addEventListener('click', () => {
        titleClickCount++;
        if (titleClickCount >= 10) {
          titleClickCount = 0;
          Daily.checkAndUnlock(data, 'love');
          Storage.save();
          showAchievementToast(Daily.ACH_MAP['love']);
        }
      });
    }

    Daily.checkAllAchievements(data);
    Storage.save();

    // Keyboard accessibility: make all action-cards respond to Enter/Space
    document.querySelectorAll('.action-card[role="button"]').forEach(card => {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });

    // Hardware/browser back button support
    window.addEventListener('popstate', () => {
      if (currentPage === 'game') {
        if (Board.phase === 'idle' || Board.phase === 'paused') {
          Board.phase = 'paused';
          showModal('quitModal');
        }
      } else if (currentPage === 'adventure' && selectedIsland !== null) {
        selectedIsland = null;
        renderAdventure();
        history.pushState(null, '', '');
      } else if (currentPage !== 'home') {
        navigateTo('home');
        history.pushState(null, '', '');
      }
    });
    // Push initial state so we can intercept back
    history.pushState(null, '', '');
  }

  function navigateTo(page) {
    if (currentPage === 'game' && page !== 'game') Audio.stopBgMusic();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.remove('active');
      n.removeAttribute('aria-current');
    });
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) targetPage.classList.add('active');
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) {
      navItem.classList.add('active');
      navItem.setAttribute('aria-current', 'page');
    }
    const nav = document.querySelector('.bottom-nav');
    if (nav) nav.style.display = page === 'game' ? 'none' : 'flex';
    currentPage = page;

    if (page !== 'adventure') selectedIsland = null;
    if (page !== 'story') currentStoryChapter = null;
    if (page !== 'garden' && gardenRefreshTimer) {
      clearInterval(gardenRefreshTimer);
      gardenRefreshTimer = null;
    }
    switch (page) {
      case 'home': renderHome(); break;
      case 'adventure': renderAdventure(); break;
      case 'garden': renderGarden(); break;
      case 'story': renderStory(); break;
      case 'potion': renderPotion(); break;
      case 'achievement': renderAchievements(); break;
    }
  }

  function renderHome() {
    const data = Storage.get();
    setText('homeStars', data.totalStars || 0);
    setText('homeLevels', data.stats.levelsCompleted || 0);
    setText('homeStreak', data.daily.streak || 0);

    const dailyDone = Daily.isDailyCompleted(data);
    const dailyCard = document.getElementById('dailyChallengeCard');
    if (dailyCard) {
      const desc = dailyCard.querySelector('.action-desc');
      if (desc) desc.textContent = dailyDone ? '✅ 今日已完成' : '🎯 今日任务等你来！';
    }

    const continueCard = document.getElementById('continueCard');
    if (continueCard) {
      const desc = continueCard.querySelector('.action-desc');
      const islandIdx = Math.floor((data.currentLevel || 0) / 15);
      const localLevel = (data.currentLevel || 0) % 15 + 1;
      const island = Campaign.ISLANDS[Math.min(islandIdx, Campaign.ISLANDS.length - 1)];
      if (desc) desc.textContent = `${island.name} — 第${localLevel}关`;
    }
  }

  function renderAdventure() {
    if (selectedIsland !== null) { renderLevelSelect(selectedIsland); return; }
    const data = Storage.get();
    const progress = Campaign.getIslandProgress(data);
    const container = document.getElementById('islandList');
    if (!container) return;

    let html = '';
    progress.forEach((p, i) => {
      html += `<div class="island-card ${p.unlocked ? '' : 'locked'}" data-island="${i}">
        <span class="island-emoji">${p.island.emoji}</span>
        <div class="island-info">
          <span class="island-name">${p.island.name}</span>
          <span class="island-desc">${p.island.desc}</span>
          <span class="island-progress">${p.completed}/15 完成</span>
          <span class="island-stars">⭐ ${p.totalStars}/${p.maxStars}</span>
        </div>
        ${p.unlocked ? '<span class="action-arrow">›</span>' : '<span class="lock-badge">🔒</span>'}
      </div>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.island-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => { selectedIsland = parseInt(card.dataset.island); renderLevelSelect(selectedIsland); });
    });
  }

  function renderLevelSelect(islandIndex) {
    const data = Storage.get();
    const island = Campaign.ISLANDS[islandIndex];
    const container = document.getElementById('islandList');
    if (!container) return;
    const startLevel = islandIndex * 15;

    let html = `<div class="level-select"><div class="level-select-header">
      <span class="back-btn" id="backToIslands">← </span><h3>${island.emoji} ${island.name}</h3></div>
      <div class="level-grid">`;

    for (let i = 0; i < 15; i++) {
      const globalIdx = startLevel + i;
      const stars = data.stars[globalIdx] || 0;
      const completed = stars > 0;
      const current = globalIdx === (data.currentLevel || 0);
      const locked = globalIdx > (data.currentLevel || 0) && !completed;
      const isBoss = i === 14;
      let starStr = completed ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '';

      const bossInfo = Campaign.BOSSES[island.id];
      html += `<div class="level-cell ${completed ? 'completed' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''} ${isBoss ? 'boss' : ''}"
                    data-level="${globalIdx}">
        <span class="level-num">${isBoss && bossInfo ? bossInfo.emoji : (i + 1)}</span>
        ${isBoss ? '<span class="boss-icon">BOSS</span>' : ''}
        <span class="level-stars">${starStr}</span>
      </div>`;
    }
    html += '</div></div>';
    container.innerHTML = html;

    const backBtn2 = document.getElementById('backToIslands');
    if (backBtn2) backBtn2.addEventListener('click', () => { selectedIsland = null; renderAdventure(); });
    container.querySelectorAll('.level-cell:not(.locked)').forEach(cell => {
      cell.addEventListener('click', () => startGameLevel(parseInt(cell.dataset.level)));
    });
  }

  function resetCampaignCallbacks() {
    Board.setCallbacks({
      onScoreChange: (state) => {
        updateGameUI(state);
        if (state.combo >= 3) showComboFlash(state.combo);
        const movesEl = document.getElementById('gameMoves');
        if (movesEl) {
          if (state.timeLeft > 0 && state.timeLeft < 10) movesEl.classList.add('timer-urgent');
          else movesEl.classList.remove('timer-urgent');
        }
        updateRageMeterUI(state);
      },
      onLevelComplete: handleLevelComplete,
      onLevelFail: handleLevelFail,
      onMoveComplete: (state) => {
        const data = Storage.get();
        if (state.combo > data.stats.maxCombo) data.stats.maxCombo = state.combo;
        data.stats.totalMoves++;
        Storage.save();
      }
    });
  }

  function startGameLevel(globalIndex) {
    Audio.init();
    resetCampaignCallbacks();
    currentLevelConfig = Campaign.getLevelConfig(globalIndex);
    const data = Storage.get();
    const islandIndex = Math.floor(globalIndex / 15);
    const localLevel = globalIndex % 15;
    const island = Campaign.ISLANDS[islandIndex];

    if (localLevel === 0) {
      const dialogue = Campaign.getIslandStartDialogue(island.id);
      if (dialogue.length > 0 && !data.achievements[`seen_${island.id}_start`]) {
        showDialogue(dialogue, () => {
          data.achievements[`seen_${island.id}_start`] = { unlocked: true, unlockedAt: Date.now() };
          Storage.save();
          launchLevel(currentLevelConfig);
        });
        return;
      }
    }

    if (currentLevelConfig.isBoss) {
      const dialogue = Campaign.getBossDialogue(island.id);
      if (dialogue.length > 0) { showDialogue(dialogue, () => launchLevel(currentLevelConfig)); return; }
    }
    launchLevel(currentLevelConfig);
  }

  function launchLevel(config) {
    navigateTo('game');
    Audio.startBgMusic();
    const island = Campaign.ISLANDS[config.islandIndex] || config.island;
    setText('gameLevelBadge', `${island.emoji} ${config.localLevel + 1}`);
    setText('gameMoves', config.timeLimit > 0 ? `⏰ ${config.timeLimit}s` : `步数: ${config.moves}`);
    updatePotionButtons();
    // Reset next level button text in case time attack changed it
    const nextLevelBtn = document.getElementById('nextLevelBtn');
    if (nextLevelBtn) nextLevelBtn.textContent = '下一关 →';
    Board.startLevel(config);
    Board.startLoop();
    // Reset rage meter UI
    const rageBar = document.getElementById('rageMeterBar');
    const rageText = document.getElementById('rageMeterText');
    const rageContainer = document.getElementById('rageMeterContainer');
    if (rageBar) { rageBar.style.width = '0%'; rageBar.className = 'rage-meter-bar'; }
    if (rageText) rageText.textContent = '充能中…';
    if (rageContainer) rageContainer.classList.remove('rage-ready-glow');
    const rageLabel = document.getElementById('rageMeterLabel');
    if (rageLabel) rageLabel.textContent = '⚡ 战斗能量';
    const backBtn = document.getElementById('gameBackBtn');
    if (backBtn) {
      backBtn.onclick = () => {
        if (Board.phase === 'idle' || Board.phase === 'paused') {
          Board.phase = 'paused';
          showModal('quitModal');
        }
      };
    }
    updateGameUI(Board.getState());
  }

  function updateGameUI(state) {
    if (!state) state = Board.getState();
    setText('gameScore', state.score);
    setText('gameTarget', state.targetScore);
    setText('gameCombo', state.combo);
    if (state.timeLeft > 0) {
      setText('gameMoves', `⏰ ${Math.ceil(state.timeLeft)}s`);
    } else {
      setText('gameMoves', `步数: ${state.movesLeft}`);
    }

    let objText = `${state.score} / ${state.targetScore}`;
    if (state.objectives) {
      if (state.objectives.type === 'boss') objText = `BOSS HP: ${state.bossHp}/${state.bossMaxHp}`;
      else if (state.objectives.type === 'collect' && state.objectives.items) {
        objText = state.objectives.items.map(item => {
          const gemInfo = Gems.TYPES.find(t => t.id === item.gemType);
          const label = gemInfo ? `${gemInfo.emoji}${gemInfo.name}` : item.gemType;
          return `${label}: ${state.collectProgress[item.gemType] || 0}/${item.count}`;
        }).join(' | ');
      }
    }

    let pct = 0;
    if (state.objectives && state.objectives.type === 'boss' && state.bossMaxHp > 0) {
      pct = Math.min(100, ((state.bossMaxHp - state.bossHp) / state.bossMaxHp) * 100);
    } else if (state.targetScore > 0) {
      pct = Math.min(100, (state.score / state.targetScore) * 100);
    }
    if (isNaN(pct) || !isFinite(pct)) pct = 0;

    const progressBar = document.getElementById('gameProgressBar');
    if (progressBar) progressBar.style.width = `${pct}%`;
    setText('gameProgressText', objText);
  }

  function updatePotionButtons() {
    const data = Storage.get();
    const potions = ['mana', 'frost', 'fire', 'arcane'];
    const effectMap = { mana: 'shuffle', frost: 'time', fire: 'bomb', arcane: 'rainbow', shadow: 'shadow' };
    potions.forEach(pot => {
      const btn = document.getElementById(`potionBtn_${pot}`);
      if (btn) {
        const count = data.potions.inventory[pot] || 0;
        btn.querySelector('.potion-count').textContent = count;
        btn.classList.toggle('disabled', count <= 0);
        btn.onclick = () => {
          const freshData = Storage.get();
          const freshCount = freshData.potions.inventory[pot] || 0;
          if (freshCount > 0 && Board.phase === 'idle') {
            if (Potion.usePotion(freshData, pot)) {
              Board.usePotion(effectMap[pot]);
              Storage.save();
              updatePotionButtons();
            }
          }
        };
      }
    });
  }

  function handleLevelComplete(state) {
    const data = Storage.get();
    const config = currentLevelConfig;
    if (!config) return;
    const globalIdx = config.globalIndex;
    if (globalIdx < 0) return;
    const stars = Campaign.getLevelStars(state.score, state.targetScore);

    const prevHighScore = data.highScores[globalIdx] || 0;
    const prevStars = data.stars[globalIdx] || 0;
    const isFirstCompletion = prevStars === 0;

    if (state.score > prevHighScore) {
      data.stats.totalScore += (state.score - prevHighScore);
      data.highScores[globalIdx] = state.score;
    }
    if (stars > prevStars) data.stars[globalIdx] = stars;

    let totalStars = 0;
    Object.values(data.stars).forEach(s => totalStars += s);
    data.totalStars = totalStars;

    if (globalIdx >= data.currentLevel) {
      data.currentLevel = globalIdx + 1;
      data.currentIsland = Math.floor(data.currentLevel / 15);
    }
    // Only count levelsCompleted for truly new completions (not replays)
    if (isFirstCompletion) {
      data.stats.levelsCompleted++;
    }
    if (config.isBoss && isFirstCompletion) data.stats.bossesDefeated++;

    const seedReward = Garden.getSeedFromMatch(3, Math.floor(Math.random() * Gems.COUNT));
    if (seedReward) Garden.addSeed(data, seedReward.speciesId);
    for (let s = 0; s < stars; s++) {
      const bonus = Garden.getSeedFromMatch(3 + s, Math.floor(Math.random() * Gems.COUNT));
      if (bonus) Garden.addSeed(data, bonus.speciesId);
    }

    if (state.movesLeft <= 0) Daily.checkAndUnlock(data, 'close_call');
    if (state.score >= 1000) Daily.checkAndUnlock(data, 'score_1k');
    if (state.score >= 5000) Daily.checkAndUnlock(data, 'score_5k');
    if (state.score >= 10000) Daily.checkAndUnlock(data, 'score_10k');
    Daily.checkAndUnlock(data, 'first_level');
    if (config.isBoss) Daily.checkAndUnlock(data, 'first_boss');

    const newAch = Daily.checkAllAchievements(data);
    Storage.save();

    const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    const titles = ['任务完成！', '出色表现！', '完美胜利！'];
    document.getElementById('completeEmoji').textContent = stars === 3 ? '🏆' : '⚔️';
    document.getElementById('completeTitle').textContent = titles[stars - 1] || '任务完成！';
    document.getElementById('completeStars').textContent = starStr;
    document.getElementById('completeText').textContent = `第${config.localLevel + 1}关完成！能量: ${state.score}`;
    const seedInfo = document.getElementById('completeSeedInfo');
    if (seedInfo) seedInfo.textContent = `🌿 获得 ${1 + stars} 份草药种子！`;

    showModal('completeModal');

    newAch.forEach((achId, i) => {
      setTimeout(() => { const ach = Daily.ACH_MAP[achId]; if (ach) showAchievementToast(ach); }, (i + 1) * 800);
    });

    const totalLevels = Campaign.ISLANDS.length * 15;
    const isLastLevel = globalIdx + 1 >= totalLevels;

    if (config.isBoss) {
      const dialogue = Campaign.getIslandCompleteDialogue(config.island.id);
      if (dialogue.length > 0) {
        document.getElementById('nextLevelBtn').onclick = () => {
          hideModal('completeModal');
          showDialogue(dialogue, () => {
            selectedIsland = null;
            if (isLastLevel) {
              showAchievementToast({ emoji: '🏆', name: '恭喜通关!', desc: '你已完成艾泽拉斯的所有冒险！' });
              navigateTo('home');
            } else {
              navigateTo('adventure');
            }
          });
        };
        return;
      }
    }
    document.getElementById('nextLevelBtn').onclick = () => {
      hideModal('completeModal');
      if (isLastLevel) {
        showAchievementToast({ emoji: '🏆', name: '恭喜通关!', desc: '你已完成艾泽拉斯的所有冒险！' });
        navigateTo('home');
      } else {
        startGameLevel(globalIdx + 1);
      }
    };
  }

  function handleLevelFail(state) {
    showModal('failModal');
    document.getElementById('retryBtn').onclick = () => { hideModal('failModal'); if (currentLevelConfig) launchLevel(currentLevelConfig); };
    document.getElementById('failHomeBtn').onclick = () => { hideModal('failModal'); Board.phase = 'gameover'; navigateTo('home'); };
  }

  function renderGarden() {
    // Clear any existing refresh timer
    if (gardenRefreshTimer) { clearInterval(gardenRefreshTimer); gardenRefreshTimer = null; }
    const data = Storage.get();
    const container = document.getElementById('gardenContainer');
    if (!container) return;
    const stats = Garden.getGardenStats(data);

    // Auto-refresh garden every 30 seconds while on garden page to show harvest badges appearing
    if (stats.growing > 0 || stats.ready > 0) {
      gardenRefreshTimer = setInterval(() => {
        const hasActiveModal = !!document.querySelector('.modal.show');
        if (currentPage === 'garden' && !hasActiveModal) {
          renderGarden();
        } else if (currentPage !== 'garden') {
          clearInterval(gardenRefreshTimer);
          gardenRefreshTimer = null;
        }
      }, 30000);
    }

    let html = `<div class="garden-header"><h3>🌿 要塞农场</h3>
      <span class="text-dim" style="font-size:0.75em;">🌱 ${stats.growing} 生长中 | ✨ ${stats.ready} 可收获 | 📖 ${stats.speciesCount}/${stats.totalSpecies} 物种</span></div>`;

    html += '<div class="garden-grid">';
    const layout = data.garden.layout;
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const plot = data.garden.plots.find(p => p.x === c && p.y === r);
        html += `<div class="garden-plot" data-x="${c}" data-y="${r}">`;
        if (plot) {
          const species = Garden.SPECIES_MAP[plot.speciesId];
          const stage = Garden.getPlantStage(plot);
          const stageEmoji = species ? species.stages[stage] : '🌱';
          const pct = Math.round(Garden.getGrowthPercent(plot));
          const grown = Garden.isFullyGrown(plot);
          html += `<div class="garden-plant ${grown && !plot.harvested ? 'ready-harvest' : ''} ${plot.harvested ? 'harvested' : ''}">`;
          html += `<span class="plant-emoji">${stageEmoji}</span>`;
          if (!grown && !plot.harvested) html += `<div class="plant-progress"><div class="plant-progress-bar" style="width:${pct}%"></div></div>`;
          if (grown && !plot.harvested) html += `<span class="harvest-badge">✨</span>`;
          html += `<span class="plant-name">${species ? species.name : '未知'}</span></div>`;
        } else {
          html += `<div class="garden-empty">+</div>`;
        }
        html += '</div>';
      }
    }
    html += '</div>';

    const seedEntries = Object.entries(data.garden.seeds).filter(([_, count]) => count > 0);
    if (seedEntries.length > 0) {
      html += '<div class="garden-seeds"><h3 class="section-title mt-12">🌰 种子袋</h3><div class="seed-list">';
      seedEntries.forEach(([speciesId, count]) => {
        const species = Garden.SPECIES_MAP[speciesId];
        if (species) html += `<div class="seed-item" data-species="${speciesId}"><span>${species.stages[species.stages.length - 1]}</span><span>${species.name}</span><span class="text-accent">×${count}</span></div>`;
      });
      html += '</div></div>';
    }
    // Add link to potion workshop
    html += `<div style="margin-top:12px;"><button class="btn btn-secondary btn-block" id="goToPotionBtn">⚗️ 炼金工坊</button></div>`;

    container.innerHTML = html;

    const potionBtn = document.getElementById('goToPotionBtn');
    if (potionBtn) potionBtn.addEventListener('click', () => navigateTo('potion'));

    container.querySelectorAll('.garden-plot').forEach(plot => {
      plot.addEventListener('click', () => {
        const x = parseInt(plot.dataset.x), y = parseInt(plot.dataset.y);
        const existingPlot = data.garden.plots.find(p => p.x === x && p.y === y);
        if (existingPlot) {
          const plotIndex = data.garden.plots.indexOf(existingPlot);
          if (Garden.isFullyGrown(existingPlot) && !existingPlot.harvested) {
            Audio.init(); Audio.playHarvest();
            const reward = Garden.harvestPlant(data, plotIndex);
            Storage.save();
            if (reward) showAchievementToast({ emoji: '🌾', name: '收获!', desc: reward.type === 'gems' ? `+${reward.amount} 材料` : `+1 ${Potion.RECIPES[reward.item] ? Potion.RECIPES[reward.item].name : '药剂'}` });
            Daily.checkAndUnlock(data, 'first_harvest');
            Daily.checkAllAchievements(data);
            Storage.save();
            renderGarden();
          } else if (existingPlot.harvested) {
            Garden.removePlant(data, plotIndex); Storage.save(); renderGarden();
          }
        } else {
          selectedPlot = { x, y };
          showSeedPicker();
        }
      });
    });
  }

  function showSeedPicker() {
    const data = Storage.get();
    const seedEntries = Object.entries(data.garden.seeds).filter(([_, count]) => count > 0);
    if (seedEntries.length === 0) { showAchievementToast({ emoji: '🌰', name: '没有种子', desc: '完成任务来获取种子！' }); return; }

    let html = '<div class="seed-picker">';
    seedEntries.forEach(([speciesId, count]) => {
      const species = Garden.SPECIES_MAP[speciesId];
      if (!species) return;
      const rarityColors = { common: '#888', uncommon: '#4ECDC4', rare: '#A29BFE', legendary: '#FFD700' };
      html += `<div class="seed-option" data-species="${speciesId}"><span class="seed-emoji">${species.stages[species.stages.length - 1]}</span>
        <div class="seed-info"><span class="seed-name">${species.name}</span><span class="seed-rarity" style="color:${rarityColors[species.rarity]}">${species.rarity}</span></div>
        <span class="seed-qty">×${count}</span></div>`;
    });
    html += '</div>';
    document.getElementById('seedPickerContent').innerHTML = html;
    showModal('seedModal');

    document.querySelectorAll('.seed-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const speciesId = opt.dataset.species;
        const data = Storage.get();
        if (selectedPlot && Garden.plantSeed(data, speciesId, selectedPlot.x, selectedPlot.y)) {
          Audio.init(); Audio.playPlant();
          Daily.checkAndUnlock(data, 'first_plant');
          Daily.checkAllAchievements(data);
          Storage.save();
          hideModal('seedModal');
          renderGarden();
        }
      });
    });
  }

  function renderStory() {
    const data = Storage.get();
    const container = document.getElementById('storyContainer');
    if (!container) return;

    if (currentStoryChapter) {
      Story.renderChapterDetail(container, currentStoryChapter, data);
      const storyBackBtn = document.getElementById('backToStoryList');
      if (storyBackBtn) storyBackBtn.addEventListener('click', () => {
        currentStoryChapter = null;
        renderStory();
      });
      return;
    }

    Story.renderStoryPage(container, data);
    container.querySelectorAll('.story-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        currentStoryChapter = card.dataset.chapter;
        renderStory();
      });
    });
  }

  function renderPotion() {
    const data = Storage.get();
    const container = document.getElementById('potionContainer');
    if (!container) return;
    Potion.renderPotionPage(container, data);
    // Add back button at top of potion page
    const backHtml = `<div style="padding:4px 0 8px;"><span class="back-btn" id="potionBackBtn" style="font-size:1.2em;cursor:pointer;">← 返回农场</span></div>`;
    container.insertAdjacentHTML('afterbegin', backHtml);
    const backBtn = document.getElementById('potionBackBtn');
    if (backBtn) backBtn.addEventListener('click', () => navigateTo('garden'));
    container.querySelectorAll('.btn-craft').forEach(btn => {
      btn.addEventListener('click', () => {
        const potionId = btn.dataset.potion;
        Audio.init();
        if (Potion.craft(data, potionId)) {
          Audio.playCraft();
          Daily.checkAndUnlock(data, 'first_potion');
          Daily.checkAllAchievements(data);
          Storage.save();
          renderPotion();
          showAchievementToast({ emoji: Potion.RECIPES[potionId].emoji, name: '炼制成功!', desc: `${Potion.RECIPES[potionId].name} +1` });
        }
      });
    });
  }

  function renderAchievements() {
    const data = Storage.get();
    const container = document.getElementById('achievementContainer');
    if (!container) return;
    Daily.renderAchievementsPage(container, data);
  }

  function startTimeAttack() {
    Audio.init();
    const config = {
      rows: 8, cols: 8, moves: 999, timeLimit: 60, targetScore: 999999, gemCount: 6,
      obstacles: [], isBoss: false, islandIndex: 0, localLevel: 0, globalIndex: -2,
      island: { id: 'arena', name: '竞技场', emoji: '⏱️' }
    };
    currentLevelConfig = config;
    launchLevel(config);
    const showTimeAttackResult = (state) => {
      const data = Storage.get();
      const prevBest = data.stats.timeAttackBest || 0;
      const isNewBest = state.score > prevBest;
      if (isNewBest) {
        data.stats.timeAttackBest = state.score;
        Storage.save();
      }
      // Star rating: 1★ = 500, 2★ = 1500, 3★ = 3000
      const starCount = state.score >= 3000 ? 3 : state.score >= 1500 ? 2 : state.score >= 500 ? 1 : 0;
      const starStr = '⭐'.repeat(starCount) + '☆'.repeat(3 - starCount);
      document.getElementById('completeEmoji').textContent = isNewBest ? '🏆' : '⏱️';
      document.getElementById('completeTitle').textContent = isNewBest ? '新纪录！' : '竞技场结算！';
      document.getElementById('completeStars').textContent = starStr;
      document.getElementById('completeText').textContent = `⏱️ 60秒得分: ${state.score}`;
      const seedInfo = document.getElementById('completeSeedInfo');
      if (seedInfo) {
        if (isNewBest) {
          seedInfo.textContent = `🔥 New Best! 上次: ${prevBest}`;
          seedInfo.style.color = '#FFD700';
        } else {
          seedInfo.textContent = `📊 最高纪录: ${prevBest}`;
          seedInfo.style.color = '';
        }
      }
      showModal('completeModal');
      document.getElementById('nextLevelBtn').textContent = '再挑战 ⏱️';
      document.getElementById('nextLevelBtn').onclick = () => { hideModal('completeModal'); startTimeAttack(); };
    };
    Board.setCallbacks({
      onScoreChange: (state) => {
        updateGameUI(state);
        if (state.combo >= 3) showComboFlash(state.combo);
        const movesEl = document.getElementById('gameMoves');
        if (movesEl) {
          if (state.timeLeft > 0 && state.timeLeft < 10) movesEl.classList.add('timer-urgent');
          else movesEl.classList.remove('timer-urgent');
        }
        updateRageMeterUI(state);
      },
      onLevelComplete: showTimeAttackResult,
      onLevelFail: showTimeAttackResult,
      onMoveComplete: (state) => { const d = Storage.get(); d.stats.totalMoves++; Storage.save(); }
    });
  }

  function startDailyChallenge() {
    Audio.init();
    const data = Storage.get();
    if (Daily.isDailyCompleted(data)) { showAchievementToast({ emoji: '✅', name: '今日已完成', desc: '明天再来挑战！' }); return; }

    const dailyConfig = Daily.getDailyChallenge();
    currentLevelConfig = { ...dailyConfig, islandIndex: 0, localLevel: 0, island: { id: 'daily', name: '世界任务', emoji: '📅' }, isBoss: false, globalIndex: -1 };
    launchLevel(currentLevelConfig);
    Board.setCallbacks({
      onScoreChange: (state) => { updateGameUI(state); updateRageMeterUI(state); },
      onLevelComplete: (state) => {
        Daily.completeDailyChallenge(data, state.score);
        Daily.checkAllAchievements(data);
        Storage.save();
        document.getElementById('completeEmoji').textContent = '📅';
        document.getElementById('completeTitle').textContent = '世界任务完成!';
        document.getElementById('completeStars').textContent = `能量: ${state.score}`;
        document.getElementById('completeText').textContent = `🔥 连续${data.daily.streak}天！`;
        if (document.getElementById('completeSeedInfo')) document.getElementById('completeSeedInfo').textContent = '';
        showModal('completeModal');
        document.getElementById('nextLevelBtn').onclick = () => { hideModal('completeModal'); navigateTo('home'); };
      },
      onLevelFail: handleLevelFail,
      onMoveComplete: (state) => { const d = Storage.get(); d.stats.totalMoves++; Storage.save(); }
    });
  }

  function showDialogue(dialogues, onComplete) {
    dialogueQueue = dialogues;
    dialogueIndex = 0;
    const overlay = document.getElementById('dialogueOverlay');
    const box = document.getElementById('dialogueBox');
    if (!overlay || !box) { if (onComplete) onComplete(); return; }

    function showLine() {
      if (dialogueIndex >= dialogueQueue.length) { overlay.classList.remove('show'); if (onComplete) onComplete(); return; }
      const line = dialogueQueue[dialogueIndex];
      const portrait = document.getElementById('dialoguePortrait');
      const speaker = document.getElementById('dialogueSpeaker');
      const text = document.getElementById('dialogueText');
      if (portrait) portrait.textContent = line.mood ? Campaign.CHARACTER.portraits[line.mood] || '⚔️' : line.speaker.substring(0, 2);
      if (speaker) speaker.textContent = line.speaker;
      if (text) text.textContent = line.text;
      dialogueIndex++;
    }
    overlay.classList.add('show');
    showLine();
    overlay.onclick = () => { Audio.init(); Audio.playSelect(); showLine(); };
  }

  function showTutorial() {
    const overlay = document.getElementById('tutorialOverlay');
    if (!overlay) return;
    const gemsDiv = document.getElementById('tutorialGems');
    if (gemsDiv) {
      gemsDiv.innerHTML = '';
      Gems.TYPES.forEach(g => {
        const d = document.createElement('div');
        d.className = 'tutorial-gem';
        d.style.background = `linear-gradient(135deg, ${g.c1}, ${g.c2})`;
        d.style.border = `2px solid ${g.border}`;
        d.style.borderRadius = '6px';
        d.textContent = g.emoji;
        gemsDiv.appendChild(d);
      });
    }
    overlay.classList.add('show');
    document.getElementById('startGameBtn').addEventListener('click', () => {
      Audio.init();
      const data = Storage.get();
      data.tutorialDone = true;
      Storage.save();
      overlay.classList.remove('show');
      navigateTo('home');
    });
  }

  function showModal(id) { const m = document.getElementById(id); if (m) m.classList.add('show'); }
  function hideModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('show'); }

  function showAchievementToast(ach) {
    if (!ach) return;
    while (document.querySelectorAll('.achievement-toast').length >= 3) {
      const oldest = document.querySelector('.achievement-toast');
      if (!oldest) break;
      oldest.remove();
    }
    const currentCount = document.querySelectorAll('.achievement-toast').length;
    const topOffset = 60 + currentCount * 68;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.style.top = topOffset + 'px';

    // Build sparkle dots
    let sparkleHTML = '<div class="toast-sparkle" aria-hidden="true">';
    const sparklePositions = [
      { x: -8, y: -8 }, { x: 108, y: -6 }, { x: -10, y: 40 }, { x: 106, y: 38 },
      { x: 50, y: -12 }, { x: 20, y: -6 }, { x: 80, y: -8 }
    ];
    sparklePositions.forEach((pos, i) => {
      const delay = i * 0.05;
      const sx = (Math.random() - 0.5) * 30;
      const sy = (Math.random() - 0.5) * 30 - 15;
      sparkleHTML += `<div class="toast-sparkle-dot" style="left:${pos.x}px;top:${pos.y}px;animation-delay:${delay}s;--sx:${sx}px;--sy:${sy}px;"></div>`;
    });
    sparkleHTML += '</div>';

    toast.innerHTML = `${sparkleHTML}<span class="toast-emoji">${ach.emoji}</span><div class="toast-text"><div class="toast-title">${ach.name}</div><div class="toast-desc">${ach.desc || ''}</div></div>`;
    document.body.appendChild(toast);
    Audio.playAchievement();
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3500);
  }

  function showComboFlash(combo) {
    const existing = document.querySelector('.combo-flash');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'combo-flash';
    let text, color;
    if (combo >= 8) { text = `🌟 ULTRA x${combo} 🌟`; color = '#C9A84C'; }
    else if (combo >= 5) { text = `💥 MEGA x${combo}`; color = '#FF4500'; }
    else { text = `🔥 COMBO x${combo}`; color = '#FF8C00'; }
    el.textContent = text;
    el.style.color = color;
    const gamePage = document.getElementById('page-game');
    if (gamePage) gamePage.appendChild(el);
    else document.body.appendChild(el);

    // CSS screen shake on the board container
    const gamePageEl = document.getElementById('page-game');
    if (gamePageEl) {
      gamePageEl.classList.remove('board-shake-sm', 'board-shake-md', 'board-shake-lg');
      void gamePageEl.offsetWidth; // reflow to restart animation
      if (combo >= 8) gamePageEl.classList.add('board-shake-lg');
      else if (combo >= 5) gamePageEl.classList.add('board-shake-md');
      else gamePageEl.classList.add('board-shake-sm');
      setTimeout(() => gamePageEl.classList.remove('board-shake-sm', 'board-shake-md', 'board-shake-lg'), 450);
    }
    setTimeout(() => { if (el.parentNode) el.remove(); }, 900);
  }

  function updateRageMeterUI(state) {
    const pct = Effects.getRagePct();
    const bar = document.getElementById('rageMeterBar');
    const text = document.getElementById('rageMeterText');
    const label = document.getElementById('rageMeterLabel');
    const container = document.getElementById('rageMeterContainer');
    if (!bar || !text) return;
    bar.style.width = Math.round(pct * 100) + '%';
    const isReady = Effects.isRageReady();
    if (isReady) {
      bar.className = 'rage-meter-bar rage-ready';
      text.textContent = '🗡️ 点击宝石释放斩击！';
      if (container) container.classList.add('rage-ready-glow');
      if (label) label.textContent = '⚡ 战斗能量 — 已充满！';
    } else {
      bar.className = 'rage-meter-bar';
      text.textContent = pct >= 0.5 ? '能量蓄积中…' : '充能中…';
      if (container) container.classList.remove('rage-ready-glow');
      if (label) label.textContent = '⚡ 战斗能量';
    }
  }

  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

  return { init, navigateTo, startDailyChallenge, startTimeAttack, startGameLevel, showModal, hideModal };
})();

document.addEventListener('DOMContentLoaded', () => { App.init(); });
