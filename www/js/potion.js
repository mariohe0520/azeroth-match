/**
 * potion.js — 炼金合成系统
 * 收集魔法材料 → 合成艾泽拉斯药剂
 */
'use strict';

const Potion = (() => {
  const INGREDIENTS = {
    arcane: { name: '奥术精华',   emoji: '💜', color: '#805AD5' },
    fel:    { name: '邪能残渣',   emoji: '💚', color: '#38A169' },
    frost:  { name: '冰霜尘埃',   emoji: '💠', color: '#3182CE' },
    fire:   { name: '烈焰余烬',   emoji: '🔥', color: '#E53E3E' },
    shadow: { name: '暗影碎片',   emoji: '🖤', color: '#4A5568' },
    nature: { name: '自然之露',   emoji: '🌿', color: '#48BB78' },
    holy:   { name: '圣光微尘',   emoji: '✨', color: '#ECC94B' }
  };

  const RECIPES = {
    mana: {
      name: '法力药水',  emoji: '💧', desc: '重新排列棋盘上所有魔法宝石',
      color: '#3182CE', recipe: { arcane: 3, frost: 2 }, effect: 'shuffle'
    },
    frost: {
      name: '冰霜药剂',  emoji: '❄️', desc: '时间关卡中增加15秒冻结时间',
      color: '#63B3ED', recipe: { frost: 3, nature: 2 }, effect: 'time'
    },
    fire: {
      name: '烈焰药剂',  emoji: '💥', desc: '炸药爆破棋盘中心3×3区域',
      color: '#FC8181', recipe: { fire: 3, fel: 2 }, effect: 'bomb'
    },
    arcane: {
      name: '奥术精华药剂', emoji: '🌈', desc: '净化棋盘上一种颜色的所有宝石',
      color: '#B794F6', recipe: { arcane: 2, holy: 2, shadow: 1 }, effect: 'rainbow'
    },
    shadow: {
      name: '暗影药剂',  emoji: '🖤', desc: '暗影能量消除随机5个宝石',
      color: '#4A5568', recipe: { shadow: 3, arcane: 2 }, effect: 'shadow'
    }
  };

  function canCraft(data, potionId) {
    const recipe = RECIPES[potionId];
    if (!recipe) return false;
    for (const [ingredient, amount] of Object.entries(recipe.recipe)) {
      if ((data.potions.ingredients[ingredient] || 0) < amount) return false;
    }
    return true;
  }

  function craft(data, potionId) {
    if (!canCraft(data, potionId)) return false;
    const recipe = RECIPES[potionId];
    for (const [ingredient, amount] of Object.entries(recipe.recipe)) {
      data.potions.ingredients[ingredient] -= amount;
    }
    data.potions.inventory[potionId] = (data.potions.inventory[potionId] || 0) + 1;
    return true;
  }

  function usePotion(data, potionId) {
    if ((data.potions.inventory[potionId] || 0) <= 0) return false;
    data.potions.inventory[potionId]--;
    return true;
  }

  function getInventory(data) {
    return Object.entries(RECIPES).map(([id, recipe]) => ({
      id, ...recipe, count: data.potions.inventory[id] || 0, canCraft: canCraft(data, id)
    }));
  }

  function getIngredients(data) {
    return Object.entries(INGREDIENTS).map(([id, info]) => ({
      id, ...info, count: data.potions.ingredients[id] || 0
    }));
  }

  function renderPotionPage(container, data) {
    const inventory = getInventory(data);
    const ingredients = getIngredients(data);

    let html = '<div class="potion-section"><h3 class="section-title">📦 材料仓库</h3>';
    html += '<div class="ingredient-grid">';
    ingredients.forEach(ing => {
      html += `<div class="ingredient-item"><span class="ingredient-emoji">${ing.emoji}</span>
        <span class="ingredient-count">${ing.count}</span><span class="ingredient-name">${ing.name}</span></div>`;
    });
    html += '</div></div>';

    html += '<div class="potion-section"><h3 class="section-title">⚗️ 炼金工坊</h3><div class="potion-list">';
    inventory.forEach(pot => {
      const recipe = RECIPES[pot.id];
      const recipeStr = Object.entries(recipe.recipe).map(([k, v]) => `${INGREDIENTS[k].emoji}×${v}`).join(' + ');
      html += `<div class="potion-card ${pot.canCraft ? 'craftable' : ''}">
        <div class="potion-header"><span class="potion-emoji">${pot.emoji}</span>
          <div class="potion-info"><span class="potion-name">${pot.name}</span><span class="potion-desc">${pot.desc}</span></div>
          <span class="potion-count">×${pot.count}</span></div>
        <div class="potion-recipe">配方: ${recipeStr}</div>
        <button class="btn btn-small btn-craft" data-potion="${pot.id}" ${pot.canCraft ? '' : 'disabled'}>
          ${pot.canCraft ? '✨ 炼制' : '材料不足'}</button></div>`;
    });
    html += '</div></div>';
    container.innerHTML = html;
  }

  return { INGREDIENTS, RECIPES, canCraft, craft, usePotion, getInventory, getIngredients, renderPotionPage };
})();
