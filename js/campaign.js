/**
 * campaign.js — 10大区域 × 15关卡 魔兽世界史诗战役
 * 深度WoW剧情、Boss战、区域特色机制
 */
'use strict';

const Campaign = (() => {
  const ISLANDS = [
    { id: 'elwynn',      name: '艾尔文森林',    emoji: '🌳', desc: '联盟起源之地，暴风城的门户', color: '#48BB78', bgColor: '#F0FFF4', mechanic: null, unlockStars: 0 },
    { id: 'durotar',     name: '杜隆塔尔',      emoji: '🏜️', desc: '部落的红土荒原，奥格瑞玛矗立于此', color: '#ED8936', bgColor: '#FFFAF0', mechanic: 'sandstorm', unlockStars: 10 },
    { id: 'stranglethorn',name:'荆棘谷',         emoji: '🌴', desc: '危机四伏的热带丛林，海盗与巨魔出没', color: '#38A169', bgColor: '#F0FFF4', mechanic: 'jungle', unlockStars: 25 },
    { id: 'ashenvale',   name: '灰谷',          emoji: '🌲', desc: '暗夜精灵的古老领地，世界之树的守护', color: '#9F7AEA', bgColor: '#FAF5FF', mechanic: 'moonwell', unlockStars: 40 },
    { id: 'tanaris',     name: '塔纳利斯',      emoji: '⏳', desc: '无尽沙海中藏着时光之穴的秘密', color: '#ECC94B', bgColor: '#FFFFF0', mechanic: 'timewarp', unlockStars: 60 },
    { id: 'winterspring', name: '冬泉谷',       emoji: '❄️', desc: '永恒寒冬笼罩的银色世界', color: '#63B3ED', bgColor: '#EBF8FF', mechanic: 'ice', unlockStars: 80 },
    { id: 'outland',     name: '外域',          emoji: '🌀', desc: '破碎的德拉诺，燃烧军团的前线', color: '#68D391', bgColor: '#F0FFF4', mechanic: 'fel', unlockStars: 100 },
    { id: 'northrend',   name: '诺森德',        emoji: '💀', desc: '冰冠堡垒的阴影，巫妖王的领域', color: '#4299E1', bgColor: '#EBF8FF', mechanic: 'frost', unlockStars: 120 },
    { id: 'pandaria',    name: '潘达利亚',      emoji: '🐼', desc: '迷雾笼罩的神秘大陆，古老的智慧', color: '#48BB78', bgColor: '#F0FFF4', mechanic: 'mist', unlockStars: 140 },
    { id: 'azeroth',     name: '艾泽拉斯之心',  emoji: '🌍', desc: '世界之魂的最终守护，一切的终点与起点', color: '#ED8936', bgColor: '#FFFAF0', mechanic: 'all', unlockStars: 160 }
  ];

  const CHARACTER = {
    name: '勇者',
    emoji: '⚔️',
    portraits: { happy: '😊', excited: '🤩', worried: '😟', determined: '💪', surprised: '😮', love: '🥰' }
  };

  const DIALOGUES = {
    'elwynn_start': [
      { speaker: '洛萨将军', mood: null, text: '欢迎来到艾尔文森林，年轻的勇者。黑暗正在蔓延...' },
      { speaker: '勇者', mood: 'determined', text: '我将为联盟而战，守护这片土地！' },
      { speaker: '洛萨将军', mood: null, text: '收集魔法宝石的力量吧。三个相同的宝石可以释放魔法能量。' },
      { speaker: '洛萨将军', mood: null, text: '前方有迪菲亚兄弟会的余孽，小心应对！' }
    ],
    'elwynn_boss': [
      { speaker: '勇者', mood: 'surprised', text: '是范克利夫！迪菲亚兄弟会的首领！' },
      { speaker: '艾德温·范克利夫', mood: null, text: '⚔️ 暴风城背叛了我们工匠！今天你将付出代价！' },
      { speaker: '勇者', mood: 'determined', text: '你的恐怖统治到此为止，范克利夫！' }
    ],
    'elwynn_complete': [
      { speaker: '勇者', mood: 'excited', text: '迪菲亚兄弟会被击败了！艾尔文森林恢复了和平。' },
      { speaker: '洛萨将军', mood: null, text: '干得好，勇者。但更大的挑战在前方——杜隆塔尔的部落正在集结...' }
    ],

    'durotar_start': [
      { speaker: '萨尔', mood: null, text: '🐺 为了部落！欢迎来到杜隆塔尔，我们的家园。' },
      { speaker: '勇者', mood: 'surprised', text: '萨尔大酋长！我以为部落是敌人...' },
      { speaker: '萨尔', mood: null, text: '真正的敌人不是彼此，而是那些试图毁灭我们世界的力量。' },
      { speaker: '萨尔', mood: null, text: '沙尘暴会干扰你的视野，但宝石的力量能驱散迷雾。' }
    ],
    'durotar_boss': [
      { speaker: '勇者', mood: 'worried', text: '大地在震动...是什么在靠近？' },
      { speaker: '加尔鲁什', mood: null, text: '🪓 力量才是一切！我将证明部落的真正道路！' },
      { speaker: '萨尔', mood: null, text: '他已经被力量蒙蔽了双眼。勇者，阻止他！' }
    ],

    'stranglethorn_start': [
      { speaker: '赫米特·奈辛瓦里', mood: null, text: '🎯 荆棘谷！最危险也最令人兴奋的狩猎场！' },
      { speaker: '勇者', mood: 'worried', text: '我听说这里有食人族巨魔和血帆海盗...' },
      { speaker: '赫米特', mood: null, text: '正是如此！丛林中的宝石被藤蔓缠绕，需要更多技巧才能消除。' }
    ],
    'stranglethorn_boss': [
      { speaker: '血帆船长', mood: null, text: '🏴‍☠️ 哈哈！你的宝石都归我了！' },
      { speaker: '勇者', mood: 'determined', text: '海盗的好日子到头了！' }
    ],

    'ashenvale_start': [
      { speaker: '泰兰德·语风', mood: null, text: '🌙 以艾露恩之名，欢迎来到灰谷。' },
      { speaker: '勇者', mood: 'surprised', text: '这片森林...古老得令人敬畏。' },
      { speaker: '泰兰德', mood: null, text: '月井的力量可以增强你的宝石消除效果。善用它们。' },
      { speaker: '泰兰德', mood: null, text: '但要小心，恶魔的腐蚀正在侵蚀这片森林...' }
    ],
    'ashenvale_boss': [
      { speaker: '玛诺洛斯之影', mood: null, text: '👹 你们以为封印能永远困住我吗？' },
      { speaker: '勇者', mood: 'determined', text: '德鲁伊们曾经击败过你，我也可以！' }
    ],

    'tanaris_start': [
      { speaker: '诺兹多姆', mood: null, text: '⏳ 时间...是最强大也最危险的魔法。' },
      { speaker: '勇者', mood: 'surprised', text: '青铜龙军团的领袖？！' },
      { speaker: '诺兹多姆', mood: null, text: '时光之穴正在被腐蚀。在这里，时间会突然加速或减速...' },
      { speaker: '勇者', mood: 'worried', text: '这意味着我的步数可能随时改变...' }
    ],
    'tanaris_boss': [
      { speaker: '永恒之龙', mood: null, text: '🐲 时间线将被改写！没有人能阻止我！' },
      { speaker: '诺兹多姆', mood: null, text: '勇者，别让它得逞。历史不能被篡改！' }
    ],

    'winterspring_start': [
      { speaker: '勇者', mood: 'worried', text: '太冷了...这就是冬泉谷？' },
      { speaker: '冰雪女巫', mood: null, text: '❄️ 在这里，宝石会被冰封。你需要消除两次才能释放它们。' },
      { speaker: '勇者', mood: 'determined', text: '冰雪不会阻挡我的脚步！' }
    ],
    'winterspring_boss': [
      { speaker: '冰霜领主', mood: null, text: '🥶 你的热血...让我来冻结它！' },
      { speaker: '勇者', mood: 'determined', text: '寒冰终会融化！' }
    ],

    'outland_start': [
      { speaker: '伊利丹·怒风', mood: null, text: '😈 你们还没有做好准备！' },
      { speaker: '勇者', mood: 'surprised', text: '伊利丹！这就是外域？一个破碎的世界...' },
      { speaker: '伊利丹', mood: null, text: '燃烧军团的邪能污染了这里的一切。邪能宝石会扩散腐蚀。' },
      { speaker: '勇者', mood: 'determined', text: '无论如何，我必须穿过这里！' }
    ],
    'outland_boss': [
      { speaker: '基尔加丹', mood: null, text: '🔥 渺小的凡人...你不知道自己面对的是什么。' },
      { speaker: '勇者', mood: 'determined', text: '我代表艾泽拉斯所有种族的力量！' }
    ],

    'northrend_start': [
      { speaker: '提里奥·弗丁', mood: null, text: '⚔️ 勇者，冰冠堡垒就在前方。这是我们最艰难的战斗。' },
      { speaker: '勇者', mood: 'worried', text: '阿尔萨斯...曾经的王子，如今的巫妖王。' },
      { speaker: '提里奥', mood: null, text: '冰冻的力量会让宝石凝固。但圣光之泪可以净化它们。' },
      { speaker: '勇者', mood: 'determined', text: '为了洛丹伦，为了所有逝去的灵魂！' }
    ],
    'northrend_boss': [
      { speaker: '阿尔萨斯/巫妖王', mood: null, text: '💀 跪下吧。为什么要反抗？你的同伴都已倒下。' },
      { speaker: '勇者', mood: 'determined', text: '只要还有一个人站着，艾泽拉斯就不会屈服！' },
      { speaker: '提里奥', mood: null, text: '圣光啊，赐予我力量！——灰烬使者，碎裂吧！' }
    ],

    'pandaria_start': [
      { speaker: '陈·风暴烈酒', mood: null, text: '🍺 慢下来，勇者。这里有比战斗更重要的东西。' },
      { speaker: '勇者', mood: 'surprised', text: '潘达利亚...好宁静的地方。' },
      { speaker: '陈', mood: null, text: '迷雾中隐藏着古老的智慧。但也隐藏着恐惧的化身——煞。' },
      { speaker: '陈', mood: null, text: '在这里，你需要在迷雾中找到正确的消除路径。保持内心平静。' }
    ],
    'pandaria_boss': [
      { speaker: '恐惧之煞', mood: null, text: '😱 我能感受到你的恐惧...它让我更强大！' },
      { speaker: '勇者', mood: 'determined', text: '我不再恐惧！我的力量来自勇气！' }
    ],

    'azeroth_start': [
      { speaker: '麦格尼·铜须', mood: null, text: '💎 勇者...艾泽拉斯在哭泣。世界之魂受到了伤害。' },
      { speaker: '勇者', mood: 'worried', text: '这是最后的战斗了吗？' },
      { speaker: '麦格尼', mood: null, text: '恩佐斯的低语正在腐蚀世界之心。所有的力量都会在这里汇聚。' },
      { speaker: '勇者', mood: 'determined', text: '从艾尔文森林到冰冠堡垒，一路走来的力量不会白费！' }
    ],
    'azeroth_boss': [
      { speaker: '恩佐斯', mood: null, text: '👁️ 你以为你在拯救世界？你只是在延缓不可避免的终结。' },
      { speaker: '勇者', mood: 'determined', text: '只要艾泽拉斯的心还在跳动，希望就永远不会消失！' },
      { speaker: '麦格尼', mood: null, text: '所有种族的力量...部落与联盟...合为一体！' }
    ],
    'azeroth_complete': [
      { speaker: '勇者', mood: 'excited', text: '恩佐斯被封印了！艾泽拉斯得救了！' },
      { speaker: '萨尔', mood: null, text: '今天，不分部落与联盟，我们共同守护了这个世界。' },
      { speaker: '吉安娜', mood: null, text: '也许...和平真的有可能。' },
      { speaker: '勇者', mood: 'love', text: '为了艾泽拉斯！这段冒险永远不会结束。直到下一次召唤！' }
    ]
  };

  const BOSSES = {
    elwynn:       { name: '范克利夫',    emoji: '⚔️', hp: 100, attack: '毒刃突袭' },
    durotar:      { name: '加尔鲁什',    emoji: '🪓', hp: 150, attack: '碎地猛击' },
    stranglethorn:{ name: '血帆船长',    emoji: '🏴‍☠️', hp: 180, attack: '炮弹齐射' },
    ashenvale:    { name: '玛诺洛斯之影', emoji: '👹', hp: 220, attack: '堕落之血' },
    tanaris:      { name: '永恒之龙',    emoji: '🐲', hp: 250, attack: '时间扭曲' },
    winterspring: { name: '冰霜领主',    emoji: '🥶', hp: 280, attack: '极寒吐息' },
    outland:      { name: '基尔加丹',    emoji: '🔥', hp: 320, attack: '暗影烈焰' },
    northrend:    { name: '巫妖王',      emoji: '💀', hp: 400, attack: '凋零缠绕' },
    pandaria:     { name: '恐惧之煞',    emoji: '😱', hp: 350, attack: '恐惧光波' },
    azeroth:      { name: '恩佐斯',      emoji: '👁️', hp: 500, attack: '虚空崩解' }
  };

  function getLevelConfig(globalIndex) {
    const islandIndex = Math.floor(globalIndex / 15);
    const localLevel = globalIndex % 15;
    const island = ISLANDS[Math.min(islandIndex, ISLANDS.length - 1)];
    const isBoss = localLevel === 14;

    // Smoother difficulty curve: gentler at start, steeper later
    const difficulty = 1 + globalIndex * 0.06 + (islandIndex >= 3 ? (islandIndex - 2) * 0.04 : 0);
    const baseScore = Math.round((350 + globalIndex * 60) * difficulty * 0.5);
    const baseMoves = Math.max(14, 30 - Math.floor(globalIndex * 0.07));

    let objectives = null;
    let obstacles = [];
    let bossHp = 0;

    if (isBoss) {
      const boss = BOSSES[island.id];
      bossHp = boss.hp;
      objectives = { type: 'boss', bossName: boss.name, bossEmoji: boss.emoji };
    } else if (islandIndex === 0) {
      // First island: more variety in objectives to teach mechanics
      if (localLevel === 0 || localLevel === 1) {
        // Easy intro: score-based with lower target
        objectives = { type: 'score' };
      } else if (localLevel === 2) {
        // Introduce collection mechanic early
        objectives = { type: 'collect', items: [{ gemType: Gems.TYPES[0].id, count: 6 }] };
      } else if (localLevel === 3) {
        objectives = { type: 'score' };
      } else if (localLevel === 4) {
        // Collect two different types
        objectives = { type: 'collect', items: [
          { gemType: Gems.TYPES[1].id, count: 5 },
          { gemType: Gems.TYPES[2].id, count: 5 }
        ]};
      } else if (localLevel === 5) {
        objectives = { type: 'score' };
      } else if (localLevel === 6) {
        // Timed level introduction
        objectives = { type: 'score' };
      } else if (localLevel === 7) {
        objectives = { type: 'collect', items: [{ gemType: Gems.TYPES[3].id, count: 10 }] };
      } else if (localLevel === 8 || localLevel === 9) {
        objectives = { type: 'score' };
      } else if (localLevel === 10) {
        // Introduce ice obstacles in island 1
        obstacles = [
          { row: 2, col: 2, type: 'ice', hp: 2 },
          { row: 2, col: 4, type: 'ice', hp: 2 },
          { row: 4, col: 3, type: 'ice', hp: 2 }
        ];
        objectives = { type: 'clear' };
      } else if (localLevel === 11 || localLevel === 12) {
        objectives = { type: 'score' };
      } else if (localLevel === 13) {
        objectives = { type: 'collect', items: [
          { gemType: Gems.TYPES[0].id, count: 8 },
          { gemType: Gems.TYPES[4].id, count: 8 }
        ]};
      } else {
        objectives = { type: 'score' };
      }
    } else if (islandIndex === 1) {
      // Second island: introduce more variety
      if (localLevel % 5 === 2) {
        const gem1Idx = localLevel % Gems.COUNT;
        const gem2Idx = (localLevel + 2) % Gems.COUNT;
        objectives = { type: 'collect', items: [
          { gemType: Gems.TYPES[gem1Idx].id, count: Math.min(15, 6 + localLevel) },
          { gemType: Gems.TYPES[gem2Idx].id, count: Math.min(12, 5 + localLevel) }
        ]};
      } else if (localLevel % 5 === 4) {
        obstacles = generateObstacles(islandIndex, localLevel);
        objectives = { type: 'clear' };
      } else if (localLevel === 6) {
        objectives = { type: 'score' }; // timed
      } else {
        objectives = { type: 'score' };
      }
    } else {
      // Islands 3+: original variety logic
      if (localLevel % 5 === 3) {
        const gemIdx = localLevel % Gems.COUNT;
        const items = [{ gemType: Gems.TYPES[gemIdx].id, count: Math.min(20, 8 + Math.floor(globalIndex * 0.3)) }];
        // Later islands: sometimes require collecting two types
        if (islandIndex >= 4 && localLevel % 3 === 0) {
          const gem2Idx = (gemIdx + 3) % Gems.COUNT;
          items.push({ gemType: Gems.TYPES[gem2Idx].id, count: Math.min(15, 6 + Math.floor(globalIndex * 0.2)) });
        }
        objectives = { type: 'collect', items };
      } else if (localLevel % 5 === 4) {
        obstacles = generateObstacles(islandIndex, localLevel);
        objectives = { type: 'clear' };
      } else {
        objectives = { type: 'score' };
      }
    }

    // Gem count: gradual increase
    let gemCount = 7;
    if (islandIndex === 0 && localLevel < 3) gemCount = 5;
    else if (islandIndex === 0) gemCount = 5;
    else if (islandIndex === 1 && localLevel < 5) gemCount = 5;
    else if (islandIndex <= 2) gemCount = 6;

    // Grid size: start smaller for learning
    let gridRows = 8, gridCols = 8;
    if (islandIndex === 0 && localLevel < 3) { gridRows = 6; gridCols = 6; }
    else if (islandIndex === 0 && localLevel < 8) { gridRows = 7; gridCols = 7; }
    else if (islandIndex === 0) { gridRows = 7; gridCols = 7; }

    // Timed levels: appear more gradually
    let timeLimit = -1;
    if (islandIndex === 0 && localLevel === 6) timeLimit = 90; // Generous intro timer
    else if (islandIndex >= 1 && localLevel % 7 === 6) timeLimit = 60 + islandIndex * 5;

    return {
      globalIndex, islandIndex, localLevel, island, isBoss,
      rows: gridRows, cols: gridCols, targetScore: baseScore,
      moves: isBoss ? baseMoves + 8 : baseMoves,
      timeLimit,
      gemCount, objectives, obstacles, bossHp, mechanic: island.mechanic
    };
  }

  function generateObstacles(islandIndex, localLevel) {
    const obstacles = [];
    const count = 3 + Math.floor(islandIndex * 1.5);
    for (let i = 0; i < count; i++) {
      const r = 1 + Math.floor(Math.random() * 6);
      const c = 1 + Math.floor(Math.random() * 6);
      if (obstacles.find(o => o.row === r && o.col === c)) continue;
      let type = 'ice';
      if (islandIndex >= 3) type = Math.random() > 0.5 ? 'ice' : 'stone';
      if (islandIndex >= 5) type = ['ice', 'stone', 'vine'][Math.floor(Math.random() * 3)];
      obstacles.push({ row: r, col: c, type, hp: type === 'ice' ? 2 : 1 });
    }
    return obstacles;
  }

  function getDialogue(key) { return DIALOGUES[key] || []; }
  function getIslandStartDialogue(islandId) { return DIALOGUES[islandId + '_start'] || []; }
  function getBossDialogue(islandId) { return DIALOGUES[islandId + '_boss'] || []; }
  function getIslandCompleteDialogue(islandId) { return DIALOGUES[islandId + '_complete'] || []; }

  function getIslandProgress(data) {
    const progress = [];
    for (let i = 0; i < ISLANDS.length; i++) {
      const startLevel = i * 15;
      let completed = 0, totalStars = 0;
      for (let j = 0; j < 15; j++) {
        const idx = startLevel + j;
        if (data.stars[idx]) { completed++; totalStars += data.stars[idx]; }
      }
      progress.push({
        island: ISLANDS[i], completed, totalLevels: 15, totalStars, maxStars: 45,
        unlocked: data.totalStars >= ISLANDS[i].unlockStars || i === 0,
        bossDefeated: !!data.stars[startLevel + 14]
      });
    }
    return progress;
  }

  function getCurrentIslandIndex(data) { return Math.floor((data.currentLevel || 0) / 15); }

  function getLevelStars(score, targetScore) {
    if (score >= targetScore * 2.5) return 3;
    if (score >= targetScore * 1.5) return 2;
    if (score >= targetScore) return 1;
    return 0;
  }

  return {
    ISLANDS, BOSSES, CHARACTER, DIALOGUES,
    getLevelConfig, getDialogue, getIslandStartDialogue, getBossDialogue, getIslandCompleteDialogue,
    getIslandProgress, getCurrentIslandIndex, getLevelStars
  };
})();
