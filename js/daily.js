/**
 * daily.js — 世界任务、连续登录、成就系统
 * 艾泽拉斯消消乐
 */
'use strict';

const Daily = (() => {
  const ACHIEVEMENTS = [
    // Basics
    { id: 'first_match',     name: '初次消除',     emoji: '✨', desc: '完成第一次魔法匹配', category: 'basics' },
    { id: 'first_level',     name: '初出茅庐',     emoji: '🎓', desc: '完成第一个任务', category: 'basics' },
    { id: 'first_combo',     name: '连击入门',     emoji: '🔥', desc: '触发第一次连击', category: 'basics' },
    { id: 'first_special',   name: '特殊宝石',     emoji: '💎', desc: '创建第一个特殊宝石', category: 'basics' },
    { id: 'first_plant',     name: '学徒采药师',   emoji: '🌱', desc: '在要塞农场种下第一棵植物', category: 'basics' },
    { id: 'first_potion',    name: '初级炼金师',   emoji: '⚗️', desc: '炼制第一瓶药剂', category: 'basics' },
    { id: 'first_harvest',   name: '收获时刻',     emoji: '🌾', desc: '收获第一棵成熟植物', category: 'basics' },
    { id: 'first_boss',      name: '初战告捷',     emoji: '⚔️', desc: '击败第一个Boss', category: 'basics' },

    // Score
    { id: 'score_1k',        name: '千分勇者',     emoji: '🏅', desc: '单关得分超过1000', category: 'score' },
    { id: 'score_5k',        name: '五千之星',     emoji: '🌟', desc: '单关得分超过5000', category: 'score' },
    { id: 'score_10k',       name: '万分传奇',     emoji: '👑', desc: '单关得分超过10000', category: 'score' },
    { id: 'total_10k',       name: '积分新手',     emoji: '📊', desc: '累计得分10000', category: 'score' },
    { id: 'total_50k',       name: '积分高手',     emoji: '📈', desc: '累计得分50000', category: 'score' },
    { id: 'total_100k',      name: '积分大师',     emoji: '🏆', desc: '累计得分100000', category: 'score' },

    // Combo
    { id: 'combo_3',         name: '三连击',       emoji: '3️⃣', desc: '达成3连击', category: 'combo' },
    { id: 'combo_5',         name: '五连击',       emoji: '5️⃣', desc: '达成5连击', category: 'combo' },
    { id: 'combo_8',         name: '八连击',       emoji: '8️⃣', desc: '达成8连击', category: 'combo' },
    { id: 'combo_10',        name: '十连击',       emoji: '🔟', desc: '达成10连击', category: 'combo' },
    { id: 'combo_15',        name: '连击大师',     emoji: '💥', desc: '达成15连击', category: 'combo' },

    // Progress
    { id: 'level_10',        name: '探索者',       emoji: '🎯', desc: '完成10个任务', category: 'progress' },
    { id: 'level_25',        name: '冒险者',       emoji: '🗺️', desc: '完成25个任务', category: 'progress' },
    { id: 'level_50',        name: '征服者',       emoji: '🧭', desc: '完成50个任务', category: 'progress' },
    { id: 'level_100',       name: '英雄',         emoji: '⚡', desc: '完成100个任务', category: 'progress' },
    { id: 'level_150',       name: '传奇勇者',     emoji: '🦸', desc: '完成全部150个任务', category: 'progress' },

    // Stars
    { id: 'stars_10',        name: '十星闪耀',     emoji: '⭐', desc: '获得10颗星', category: 'stars' },
    { id: 'stars_50',        name: '五十星辉',     emoji: '🌟', desc: '获得50颗星', category: 'stars' },
    { id: 'stars_100',       name: '百星传奇',     emoji: '💫', desc: '获得100颗星', category: 'stars' },
    { id: 'stars_200',       name: '双百之光',     emoji: '✨', desc: '获得200颗星', category: 'stars' },
    { id: 'stars_450',       name: '全星收集',     emoji: '🏆', desc: '收集全部450颗星', category: 'stars' },

    // Zones
    { id: 'island_elwynn',      name: '艾尔文英雄',   emoji: '🌳', desc: '完成艾尔文森林', category: 'zones' },
    { id: 'island_durotar',     name: '杜隆塔尔英雄', emoji: '🏜️', desc: '完成杜隆塔尔', category: 'zones' },
    { id: 'island_stranglethorn',name:'荆棘谷英雄',   emoji: '🌴', desc: '完成荆棘谷', category: 'zones' },
    { id: 'island_ashenvale',   name: '灰谷英雄',     emoji: '🌲', desc: '完成灰谷', category: 'zones' },
    { id: 'island_tanaris',     name: '塔纳利斯英雄', emoji: '⏳', desc: '完成塔纳利斯', category: 'zones' },
    { id: 'island_winterspring', name:'冬泉谷英雄',   emoji: '❄️', desc: '完成冬泉谷', category: 'zones' },
    { id: 'island_outland',     name: '外域征服者',   emoji: '🌀', desc: '完成外域', category: 'zones' },
    { id: 'island_northrend',   name: '诺森德征服者', emoji: '💀', desc: '完成诺森德', category: 'zones' },
    { id: 'island_pandaria',    name: '潘达利亚英雄', emoji: '🐼', desc: '完成潘达利亚', category: 'zones' },
    { id: 'island_azeroth',     name: '艾泽拉斯守护者',emoji:'🌍', desc: '完成艾泽拉斯之心', category: 'zones' },

    // Boss
    { id: 'boss_first',      name: '勇者之路',     emoji: '⚔️', desc: '击败第一个Boss', category: 'boss' },
    { id: 'boss_5',          name: '精英猎手',     emoji: '🗡️', desc: '击败5个Boss', category: 'boss' },
    { id: 'boss_all',        name: '全清成就',     emoji: '🐲', desc: '击败全部10个Boss', category: 'boss' },

    // Garden
    { id: 'garden_5',        name: '学徒采药师',   emoji: '🌱', desc: '农场中种满5棵', category: 'garden' },
    { id: 'garden_10',       name: '熟练采药师',   emoji: '🌿', desc: '农场中种满10棵', category: 'garden' },
    { id: 'garden_20',       name: '大师采药师',   emoji: '🌳', desc: '农场中种满20棵', category: 'garden' },
    { id: 'species_10',      name: '收集新手',     emoji: '📖', desc: '解锁10种物种', category: 'garden' },
    { id: 'species_25',      name: '博物学家',     emoji: '🔬', desc: '解锁25种物种', category: 'garden' },

    // Daily
    { id: 'daily_first',     name: '世界任务',     emoji: '📅', desc: '完成第一个世界任务', category: 'daily' },
    { id: 'daily_7',         name: '一周坚持',     emoji: '📆', desc: '完成7个世界任务', category: 'daily' },
    { id: 'daily_30',        name: '月度达人',     emoji: '🗓️', desc: '完成30个世界任务', category: 'daily' },
    { id: 'streak_3',        name: '三日连胜',     emoji: '🔥', desc: '连续3天登录', category: 'daily' },
    { id: 'streak_7',        name: '周连胜',       emoji: '🔥', desc: '连续7天登录', category: 'daily' },
    { id: 'streak_30',       name: '月度之星',     emoji: '⭐', desc: '连续30天登录', category: 'daily' },

    // Fun
    { id: 'close_call',      name: '绝处逢生',     emoji: '😅', desc: '最后一步通关', category: 'special' },
    { id: 'night_owl',       name: '夜猫子',       emoji: '🦉', desc: '在凌晨12点后游戏', category: 'special' },
    { id: 'love',            name: '为了艾泽拉斯', emoji: '💕', desc: '发现隐藏彩蛋', category: 'special' },

    // Gems
    { id: 'total_gems_1k',   name: '千宝收割者',   emoji: '💎', desc: '累计消除1000个宝石', category: 'gems' },
    { id: 'total_gems_10k',  name: '万宝之主',     emoji: '👑', desc: '累计消除10000个宝石', category: 'gems' },

    // Moves
    { id: 'total_moves_1k',  name: '千步旅者',     emoji: '👣', desc: '累计使用1000步', category: 'moves' },
    { id: 'total_moves_5k',  name: '五千里路',     emoji: '🚶', desc: '累计使用5000步', category: 'moves' },
  ];

  const ACH_MAP = {};
  ACHIEVEMENTS.forEach(a => { ACH_MAP[a.id] = a; });

  function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getDailyChallenge() {
    const today = getTodayString();
    const seed = hashCode(today);
    const rng = seededRandom(seed);
    return {
      date: today,
      targetScore: 2000 + Math.floor(rng() * 3000),
      moves: 15 + Math.floor(rng() * 10),
      rows: 8, cols: 8,
      gemCount: 6 + Math.floor(rng() * 2),
      obstacles: generateDailyObstacles(rng),
      objectives: { type: 'score' }
    };
  }

  function generateDailyObstacles(rng) {
    const obstacles = [];
    const count = 2 + Math.floor(rng() * 6);
    for (let i = 0; i < count; i++) {
      obstacles.push({ row: 1 + Math.floor(rng() * 6), col: 1 + Math.floor(rng() * 6), type: rng() > 0.5 ? 'ice' : 'stone', hp: 2 });
    }
    return obstacles;
  }

  function isDailyCompleted(data) { return data.daily.completedDailies.includes(getTodayString()); }

  function completeDailyChallenge(data, score) {
    const today = getTodayString();
    if (!data.daily.completedDailies.includes(today)) data.daily.completedDailies.push(today);
    if (score > data.daily.weeklyBest) data.daily.weeklyBest = score;
  }

  function updateStreak(data) {
    const today = getTodayString();
    if (data.daily.lastPlayedDate === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    data.daily.streak = data.daily.lastPlayedDate === yesterdayStr ? data.daily.streak + 1 : 1;
    if (data.daily.streak > data.daily.bestStreak) data.daily.bestStreak = data.daily.streak;
    data.daily.lastPlayedDate = today;
  }

  function checkAndUnlock(data, achievementId) {
    if (data.achievements[achievementId]) return false;
    data.achievements[achievementId] = { unlocked: true, unlockedAt: Date.now() };
    return true;
  }

  function checkAllAchievements(data) {
    const n = [];
    if (data.stats.totalScore >= 10000)  if (checkAndUnlock(data, 'total_10k'))  n.push('total_10k');
    if (data.stats.totalScore >= 50000)  if (checkAndUnlock(data, 'total_50k'))  n.push('total_50k');
    if (data.stats.totalScore >= 100000) if (checkAndUnlock(data, 'total_100k')) n.push('total_100k');
    if (data.stats.levelsCompleted >= 10)  if (checkAndUnlock(data, 'level_10'))  n.push('level_10');
    if (data.stats.levelsCompleted >= 25)  if (checkAndUnlock(data, 'level_25'))  n.push('level_25');
    if (data.stats.levelsCompleted >= 50)  if (checkAndUnlock(data, 'level_50'))  n.push('level_50');
    if (data.stats.levelsCompleted >= 100) if (checkAndUnlock(data, 'level_100')) n.push('level_100');
    if (data.stats.levelsCompleted >= 150) if (checkAndUnlock(data, 'level_150')) n.push('level_150');
    if (data.totalStars >= 10)  if (checkAndUnlock(data, 'stars_10'))  n.push('stars_10');
    if (data.totalStars >= 50)  if (checkAndUnlock(data, 'stars_50'))  n.push('stars_50');
    if (data.totalStars >= 100) if (checkAndUnlock(data, 'stars_100')) n.push('stars_100');
    if (data.totalStars >= 200) if (checkAndUnlock(data, 'stars_200')) n.push('stars_200');
    if (data.totalStars >= 450) if (checkAndUnlock(data, 'stars_450')) n.push('stars_450');
    if (data.stats.maxCombo >= 3)  if (checkAndUnlock(data, 'combo_3'))  n.push('combo_3');
    if (data.stats.maxCombo >= 5)  if (checkAndUnlock(data, 'combo_5'))  n.push('combo_5');
    if (data.stats.maxCombo >= 8)  if (checkAndUnlock(data, 'combo_8'))  n.push('combo_8');
    if (data.stats.maxCombo >= 10) if (checkAndUnlock(data, 'combo_10')) n.push('combo_10');
    if (data.stats.maxCombo >= 15) if (checkAndUnlock(data, 'combo_15')) n.push('combo_15');
    if (data.stats.bossesDefeated >= 1)  if (checkAndUnlock(data, 'boss_first')) n.push('boss_first');
    if (data.stats.bossesDefeated >= 5)  if (checkAndUnlock(data, 'boss_5'))     n.push('boss_5');
    if (data.stats.bossesDefeated >= 10) if (checkAndUnlock(data, 'boss_all'))   n.push('boss_all');
    const gs = Garden.getGardenStats(data);
    if (gs.total >= 5)  if (checkAndUnlock(data, 'garden_5'))  n.push('garden_5');
    if (gs.total >= 10) if (checkAndUnlock(data, 'garden_10')) n.push('garden_10');
    if (gs.total >= 20) if (checkAndUnlock(data, 'garden_20')) n.push('garden_20');
    if (gs.speciesCount >= 10) if (checkAndUnlock(data, 'species_10')) n.push('species_10');
    if (gs.speciesCount >= 25) if (checkAndUnlock(data, 'species_25')) n.push('species_25');
    if (data.stats.totalGems >= 1000)  if (checkAndUnlock(data, 'total_gems_1k'))  n.push('total_gems_1k');
    if (data.stats.totalGems >= 10000) if (checkAndUnlock(data, 'total_gems_10k')) n.push('total_gems_10k');
    if (data.daily.streak >= 3)  if (checkAndUnlock(data, 'streak_3'))  n.push('streak_3');
    if (data.daily.streak >= 7)  if (checkAndUnlock(data, 'streak_7'))  n.push('streak_7');
    if (data.daily.streak >= 30) if (checkAndUnlock(data, 'streak_30')) n.push('streak_30');
    const dc = data.daily.completedDailies.length;
    if (dc >= 1)  if (checkAndUnlock(data, 'daily_first')) n.push('daily_first');
    if (dc >= 7)  if (checkAndUnlock(data, 'daily_7'))     n.push('daily_7');
    if (dc >= 30) if (checkAndUnlock(data, 'daily_30'))    n.push('daily_30');
    if (data.stats.totalMoves >= 1000) if (checkAndUnlock(data, 'total_moves_1k')) n.push('total_moves_1k');
    if (data.stats.totalMoves >= 5000) if (checkAndUnlock(data, 'total_moves_5k')) n.push('total_moves_5k');
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) if (checkAndUnlock(data, 'night_owl')) n.push('night_owl');

    // Zone completion achievements
    const zoneIds = ['elwynn','durotar','stranglethorn','ashenvale','tanaris','winterspring','outland','northrend','pandaria','azeroth'];
    zoneIds.forEach((zoneId, idx) => {
      const startLevel = idx * 15;
      let allCompleted = true;
      for (let j = 0; j < 15; j++) {
        if (!data.stars[startLevel + j] || data.stars[startLevel + j] <= 0) { allCompleted = false; break; }
      }
      if (allCompleted) {
        const achId = 'island_' + zoneId;
        if (checkAndUnlock(data, achId)) n.push(achId);
      }
    });

    return n;
  }

  function getAchievementProgress(data) {
    const total = ACHIEVEMENTS.length;
    const unlocked = Object.keys(data.achievements).filter(k => !k.startsWith('seen_')).length;
    return { total, unlocked, pct: Math.round((unlocked / total) * 100) };
  }

  function renderAchievementsPage(container, data) {
    const progress = getAchievementProgress(data);
    const categories = {};
    ACHIEVEMENTS.forEach(ach => {
      if (!categories[ach.category]) categories[ach.category] = [];
      categories[ach.category].push({ ...ach, unlocked: !!data.achievements[ach.id] });
    });

    const catNames = {
      basics: '🎮 入门', score: '🏅 得分', combo: '🔥 连击', progress: '🗺️ 进度',
      stars: '⭐ 星级', zones: '🌍 区域', boss: '⚔️ Boss', garden: '🌱 采药',
      daily: '📅 世界任务', special: '🏆 特殊', gems: '💎 宝石', moves: '👣 步数'
    };

    let html = `<div class="achievement-header"><h3>🏆 成就</h3>
      <div class="achievement-progress-bar"><div class="progress-fill" style="width:${progress.pct}%"></div>
      <span class="progress-label">${progress.unlocked}/${progress.total} (${progress.pct}%)</span></div></div>`;
    html += '<div class="streak-info">';
    html += `<div class="streak-item">🔥 连续: <strong>${data.daily.streak}天</strong></div>`;
    html += `<div class="streak-item">📅 任务: <strong>${data.daily.completedDailies.length}次</strong></div>`;
    html += `<div class="streak-item">🏆 最佳: <strong>${data.daily.bestStreak}天</strong></div>`;
    html += '</div>';

    for (const [cat, achs] of Object.entries(categories)) {
      html += `<div class="achievement-category"><h4 class="category-title">${catNames[cat] || cat}</h4><div class="achievement-list">`;
      achs.forEach(ach => {
        html += `<div class="achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}">
          <span class="ach-emoji">${ach.unlocked ? ach.emoji : '🔒'}</span>
          <div class="ach-info"><span class="ach-name">${ach.name}</span><span class="ach-desc">${ach.desc}</span></div></div>`;
      });
      html += '</div></div>';
    }
    container.innerHTML = html;
  }

  function hashCode(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; } return Math.abs(hash); }
  function seededRandom(seed) { let s = seed; return function() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }; }

  return {
    ACHIEVEMENTS, ACH_MAP, getTodayString, getDailyChallenge, isDailyCompleted,
    completeDailyChallenge, updateStreak, checkAndUnlock, checkAllAchievements,
    getAchievementProgress, renderAchievementsPage
  };
})();
