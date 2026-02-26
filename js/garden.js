/**
 * garden.js — 要塞农场系统 (Garrison Farm)
 * 种植艾泽拉斯草药、培育魔法生物
 */
'use strict';

const Garden = (() => {
  const SPECIES = [
    // WoW Herbs
    { id: 'peacebloom',    name: '宁神花',    emoji: '🌸', category: 'herb', rarity: 'common',    growTime: 3600000 * 1.5, stages: ['🌱','🌿','🌸','🌸','🌸'], reward: { type: 'gems', amount: 4 } },
    { id: 'silverleaf',    name: '银叶草',    emoji: '🌿', category: 'herb', rarity: 'common',    growTime: 3600000 * 1.5, stages: ['🌱','🌿','🍃','🌿','🌿'], reward: { type: 'gems', amount: 4 } },
    { id: 'earthroot',     name: '地根草',    emoji: '🫚', category: 'herb', rarity: 'common',    growTime: 3600000 * 2,   stages: ['🌱','🌿','🪴','🫚','🫚'], reward: { type: 'gems', amount: 5 } },
    { id: 'mageroyal',     name: '魔皇草',    emoji: '👑', category: 'herb', rarity: 'uncommon',  growTime: 3600000 * 3,   stages: ['🌱','🌿','🌾','👑','👑'], reward: { type: 'potion', item: 'mana' } },
    { id: 'briarthorn',    name: '石南草',    emoji: '🌵', category: 'herb', rarity: 'common',    growTime: 3600000 * 2,   stages: ['🌱','🌿','🌵','🌵','🌵'], reward: { type: 'gems', amount: 5 } },
    { id: 'stranglekelp',  name: '荆棘藻',    emoji: '🪸', category: 'herb', rarity: 'uncommon',  growTime: 3600000 * 3,   stages: ['🌱','💧','🪸','🪸','🪸'], reward: { type: 'gems', amount: 6 } },
    { id: 'bruiseweed',    name: '跌打草',    emoji: '💜', category: 'herb', rarity: 'common',    growTime: 3600000 * 2,   stages: ['🌱','🌿','💜','💜','💜'], reward: { type: 'gems', amount: 5 } },

    // Advanced Herbs
    { id: 'dreamfoil',     name: '梦叶草',    emoji: '💤', category: 'herb', rarity: 'rare',      growTime: 3600000 * 6,   stages: ['🌱','🌿','✨','💤','💤'], reward: { type: 'potion', item: 'arcane' } },
    { id: 'goldenthorn',   name: '金棘草',    emoji: '🌟', category: 'herb', rarity: 'uncommon',  growTime: 3600000 * 4,   stages: ['🌱','🌿','🌾','🌟','🌟'], reward: { type: 'gems', amount: 8 } },
    { id: 'firebloom',     name: '火焰花',    emoji: '🔥', category: 'herb', rarity: 'uncommon',  growTime: 3600000 * 3,   stages: ['🌱','🌿','🔥','🔥','🔥'], reward: { type: 'potion', item: 'fire' } },
    { id: 'icecap',        name: '冰盖草',    emoji: '❄️', category: 'herb', rarity: 'uncommon',  growTime: 3600000 * 3,   stages: ['🌱','🌿','❄️','❄️','❄️'], reward: { type: 'potion', item: 'frost' } },
    { id: 'plaguebloom',   name: '瘟疫花',    emoji: '☠️', category: 'herb', rarity: 'rare',      growTime: 3600000 * 5,   stages: ['🌱','🌿','☠️','☠️','☠️'], reward: { type: 'potion', item: 'shadow' } },
    { id: 'felweed',       name: '魔草',      emoji: '💚', category: 'herb', rarity: 'rare',      growTime: 3600000 * 5,   stages: ['🌱','💚','💚','💚','💚'], reward: { type: 'potion', item: 'arcane' } },
    { id: 'lotus_black',   name: '黑莲花',    emoji: '🖤', category: 'herb', rarity: 'legendary', growTime: 3600000 * 24,  stages: ['🌱','✨','🌿','🖤','🖤'], reward: { type: 'gems', amount: 50 } },

    // WoW Trees
    { id: 'ironwood',      name: '铁木',      emoji: '🌳', category: 'tree', rarity: 'uncommon',  growTime: 3600000 * 8,   stages: ['🌱','🌿','🪴','🌳','🌳'], reward: { type: 'gems', amount: 10 } },
    { id: 'ashwood',       name: '灰木',      emoji: '🌲', category: 'tree', rarity: 'uncommon',  growTime: 3600000 * 8,   stages: ['🌱','🌿','🪴','🌲','🌲'], reward: { type: 'gems', amount: 10 } },
    { id: 'world_tree',    name: '世界之树苗',emoji: '🌴', category: 'tree', rarity: 'legendary', growTime: 3600000 * 48,  stages: ['🌱','✨','🪴','🌴','🌴'], reward: { type: 'gems', amount: 100 } },

    // Magical Creatures (eggs)
    { id: 'whelp_egg',     name: '幼龙蛋',    emoji: '🥚', category: 'creature', rarity: 'rare',     growTime: 3600000 * 12, stages: ['🥚','🥚','💫','🐉','🐉'], reward: { type: 'gems', amount: 25 } },
    { id: 'phoenix_egg',   name: '凤凰蛋',    emoji: '🔴', category: 'creature', rarity: 'legendary',growTime: 3600000 * 36, stages: ['🔴','🔴','✨','🦅','🦅'], reward: { type: 'gems', amount: 80 } },
    { id: 'hippogryph',    name: '角鹰兽幼崽',emoji: '🦅', category: 'creature', rarity: 'uncommon', growTime: 3600000 * 6,  stages: ['🥚','🥚','🐣','🦅','🦅'], reward: { type: 'potion', item: 'mana' } },
    { id: 'frostwolf',     name: '霜狼幼崽',  emoji: '🐺', category: 'creature', rarity: 'rare',     growTime: 3600000 * 10, stages: ['🐣','🐣','🐕','🐺','🐺'], reward: { type: 'potion', item: 'frost' } },

    // Minerals
    { id: 'copper_ore',    name: '铜矿石',    emoji: '🟤', category: 'mineral', rarity: 'common',    growTime: 3600000 * 2,   stages: ['🪨','🪨','🟤','🟤','🟤'], reward: { type: 'gems', amount: 3 } },
    { id: 'iron_ore',      name: '铁矿石',    emoji: '⬛', category: 'mineral', rarity: 'common',    growTime: 3600000 * 3,   stages: ['🪨','🪨','⬛','⬛','⬛'], reward: { type: 'gems', amount: 5 } },
    { id: 'mithril_ore',   name: '秘银矿石',  emoji: '⬜', category: 'mineral', rarity: 'uncommon',  growTime: 3600000 * 5,   stages: ['🪨','🪨','✨','⬜','⬜'], reward: { type: 'gems', amount: 8 } },
    { id: 'thorium_ore',   name: '瑟银矿石',  emoji: '🟡', category: 'mineral', rarity: 'rare',      growTime: 3600000 * 8,   stages: ['🪨','🪨','✨','🟡','🟡'], reward: { type: 'gems', amount: 15 } },
    { id: 'arcane_crystal', name: '奥术水晶',  emoji: '💎', category: 'mineral', rarity: 'legendary', growTime: 3600000 * 24,  stages: ['🪨','✨','💠','💎','💎'], reward: { type: 'gems', amount: 50 } },

    // Enchanting Materials
    { id: 'soul_shard',    name: '灵魂碎片',  emoji: '🟣', category: 'enchant', rarity: 'uncommon',  growTime: 3600000 * 4,   stages: ['✨','✨','🟣','🟣','🟣'], reward: { type: 'potion', item: 'shadow' } },
    { id: 'void_crystal',  name: '虚空水晶',  emoji: '🔮', category: 'enchant', rarity: 'rare',      growTime: 3600000 * 10,  stages: ['✨','✨','💠','🔮','🔮'], reward: { type: 'gems', amount: 20 } },

    // Food/Cooking
    { id: 'wild_turkey',   name: '野火鸡',    emoji: '🦃', category: 'food', rarity: 'common',    growTime: 3600000 * 1,   stages: ['🥚','🐣','🦃','🦃','🦃'], reward: { type: 'gems', amount: 2 } },
    { id: 'golden_fish',   name: '金鳞鱼',    emoji: '🐟', category: 'food', rarity: 'uncommon',  growTime: 3600000 * 2,   stages: ['💧','💧','🐟','🐟','🐟'], reward: { type: 'gems', amount: 5 } },
    { id: 'deviate_fish',  name: '变异鱼',    emoji: '🐠', category: 'food', rarity: 'rare',      growTime: 3600000 * 4,   stages: ['💧','💧','✨','🐠','🐠'], reward: { type: 'potion', item: 'mana' } },

    // Magical Plants
    { id: 'moonwell_seed', name: '月井种子',  emoji: '🌙', category: 'magical', rarity: 'rare',      growTime: 3600000 * 10,  stages: ['🌱','✨','🌿','🌙','🌙'], reward: { type: 'potion', item: 'arcane' } },
    { id: 'sunwell_seed',  name: '太阳井种子',emoji: '☀️', category: 'magical', rarity: 'legendary', growTime: 3600000 * 48,  stages: ['🌱','✨','🌿','☀️','☀️'], reward: { type: 'gems', amount: 100 } },
    { id: 'heart_azeroth', name: '艾泽拉斯之心',emoji: '🌍', category: 'magical', rarity: 'legendary', growTime: 3600000 * 72,  stages: ['🌱','✨','🪴','🌳','🌍'], reward: { type: 'gems', amount: 200 } },
  ];

  const SPECIES_MAP = {};
  SPECIES.forEach(s => { SPECIES_MAP[s.id] = s; });

  function getSeedFromMatch(matchSize, gemType) {
    const baseHerbs = ['peacebloom','silverleaf','earthroot','briarthorn','bruiseweed','copper_ore','iron_ore'];
    const baseSpecies = baseHerbs[gemType % baseHerbs.length];

    if (matchSize >= 5) {
      const rares = SPECIES.filter(s => s.rarity === 'rare' || s.rarity === 'legendary');
      return { speciesId: rares[Math.floor(Math.random() * rares.length)].id, count: 1 };
    } else if (matchSize === 4) {
      const uncommons = SPECIES.filter(s => s.rarity === 'uncommon');
      return { speciesId: uncommons[Math.floor(Math.random() * uncommons.length)].id, count: 1 };
    }
    return { speciesId: baseSpecies, count: 1 };
  }

  function addSeed(data, speciesId) {
    if (!data.garden.seeds[speciesId]) data.garden.seeds[speciesId] = 0;
    data.garden.seeds[speciesId]++;
    if (!data.garden.unlockedSpecies.includes(speciesId)) data.garden.unlockedSpecies.push(speciesId);
  }

  function plantSeed(data, speciesId, plotX, plotY) {
    if (!data.garden.seeds[speciesId] || data.garden.seeds[speciesId] <= 0) return false;
    if (data.garden.plots.find(p => p.x === plotX && p.y === plotY)) return false;
    data.garden.seeds[speciesId]--;
    data.garden.plots.push({ speciesId, plantedAt: Date.now(), wateredAt: Date.now(), stage: 0, x: plotX, y: plotY, harvested: false });
    return true;
  }

  function getPlantStage(plot) {
    const species = SPECIES_MAP[plot.speciesId];
    if (!species) return 0;
    const elapsed = Date.now() - plot.plantedAt;
    const progress = Math.min(1, elapsed / species.growTime);
    return Math.min(species.stages.length - 1, Math.floor(progress * species.stages.length));
  }

  function isFullyGrown(plot) {
    const species = SPECIES_MAP[plot.speciesId];
    if (!species) return false;
    return getPlantStage(plot) >= species.stages.length - 1;
  }

  function getGrowthPercent(plot) {
    const species = SPECIES_MAP[plot.speciesId];
    if (!species) return 0;
    return Math.min(100, ((Date.now() - plot.plantedAt) / species.growTime) * 100);
  }

  function harvestPlant(data, plotIndex) {
    const plot = data.garden.plots[plotIndex];
    if (!plot || !isFullyGrown(plot) || plot.harvested) return null;
    const species = SPECIES_MAP[plot.speciesId];
    if (!species) return null;
    plot.harvested = true;
    const reward = species.reward;
    if (reward.type === 'gems') {
      const colors = ['arcane', 'fel', 'frost', 'fire', 'shadow', 'nature', 'holy'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      data.potions.ingredients[color] = (data.potions.ingredients[color] || 0) + reward.amount;
    } else if (reward.type === 'potion') {
      data.potions.inventory[reward.item] = (data.potions.inventory[reward.item] || 0) + 1;
    }
    return reward;
  }

  function removePlant(data, plotIndex) { data.garden.plots.splice(plotIndex, 1); }

  function getGardenStats(data) {
    let total = data.garden.plots.length, growing = 0, ready = 0, harvested = 0;
    let speciesCount = data.garden.unlockedSpecies.length;
    data.garden.plots.forEach(plot => {
      if (plot.harvested) harvested++;
      else if (isFullyGrown(plot)) ready++;
      else growing++;
    });
    return { total, growing, ready, harvested, speciesCount, totalSpecies: SPECIES.length };
  }

  return {
    SPECIES, SPECIES_MAP, getSeedFromMatch, addSeed, plantSeed,
    getPlantStage, isFullyGrown, getGrowthPercent, harvestPlant, removePlant, getGardenStats
  };
})();
