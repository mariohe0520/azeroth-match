# Azeroth Match — 代码审计报告

**审计日期**: 2026-03-01
**审计工具**: Claude Code (Sonnet 4.6 + Explore Agent)
**审计范围**: 全项目 11 个核心文件，6,600+ 行代码
**审计人**: 顶级前端游戏工程师视角

---

## 项目健康度总评分

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   项目健康度评分：  74 / 100                              │
│                                                          │
│   ████████████████████████████████████░░░░░░░░░░ 74%    │
│                                                          │
│   代码质量: 82/100   ████████████████████████░░░░        │
│   逻辑正确: 68/100   █████████████████░░░░░░░░░░░        │
│   性能表现: 79/100   ███████████████████████░░░░░        │
│   架构设计: 76/100   ████████████████████░░░░░░░         │
│   安全性:   90/100   ████████████████████████████        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**总体评价**: 项目架构扎实，特色功能丰富（天气/节奏/愤怒值/暗示系统），崩溃防护极其完善。
但存在 **1个致命 Bug**（卡死检测失效）和 **3个严重逻辑缺陷**，在高压玩法下会导致游戏卡死无法恢复。

---

## 一、文件结构审查

### ✅ 目录结构总览

```
azeroth-match/
├── index.html          主入口 HTML（319 行）
├── manifest.json       PWA 清单
├── capacitor.config.json  iOS Capacitor 配置
├── package.json        依赖配置
├── sw.js               Service Worker（v7 缓存）
├── css/
│   ├── style.css       主样式（600+ 行）
│   └── animations.css  动画样式
└── js/
    ├── app.js          页面路由 + 模态框管理（891 行）
    ├── board.js        核心消消乐引擎（2,809 行）⭐
    ├── campaign.js     关卡配置 10 区 × 15 关（450+ 行）
    ├── audio.js        Web Audio API 音效合成器（245 行）
    ├── gems.js         7 种种族宝石绘制系统（450+ 行）
    ├── effects.js      粒子/爆炸/愤怒条效果（500+ 行）
    ├── garden.js       草药农场迷你游戏（145 行）
    ├── potion.js       炼金系统
    ├── storage.js      防抖 localStorage（155 行）
    ├── daily.js        每日挑战/成就
    └── story.js        故事年鉴系统
```

**评估**: ✅ 结构清晰，职责分明
**发现**: `www/` 目录是 GitHub Pages 的镜像副本，存在文件同步风险（修改一处忘记同步另一处）。建议使用构建脚本自动同步。

---

## 二、HTML 结构审查

### ✅ 基本结构合格

- `<!DOCTYPE html>` ✅ 正确声明
- `<meta charset="UTF-8">` ✅
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` ✅ 移动端适配

### ⚠️ 无障碍（ARIA）问题

- Canvas 元素缺少 `role` 和 `aria-label` 属性
- 模态框缺少 `aria-modal="true"` 和焦点陷阱（focus trap）
- 动态生成的 Toast 通知未使用 `aria-live` 区域

### ⚠️ 语义化问题

- 大量使用 `<div>` 容器，部分可替换为 `<section>`、`<nav>`、`<header>`
- 按钮元素使用 `<div onclick>` 而非 `<button>` —— 键盘用户无法使用 Tab 键导航

---

## 三、CSS 审查

### ✅ 整体质量良好

- ✅ 动画使用 `transform` + `opacity`（GPU 加速），未使用 `top/left` 位移
- ✅ 最大宽度 440px 限制，适配手机竖屏
- ✅ CSS 变量系统（`--color-*`）主题一致
- ✅ 响应式布局覆盖常见断点

### ⚠️ 潜在问题

- **z-index 层级**: 检测到至少 5 个不同 z-index 层级（modal: 1000, toast: 9999 等），需要统一管理
- **动画性能**: `animations.css` 中部分 keyframe 使用了 `width/height` 过渡（非 GPU 加速属性）

---

## 四、JavaScript 核心逻辑审查

---

### 4a. 棋盘系统

#### ✅ 初始化无三连保证

`getRandomType()` 调用 `wouldMatchAt()` 检查，确保生成时不产生初始三连。逻辑正确。

```javascript
// board.js — 防初始三连逻辑（✅ 正确）
function getRandomType(row, col) {
  const numTypes = levelConfig ? (levelConfig.gemCount || Gems.COUNT) : Gems.COUNT;
  const types = Array.from({length: numTypes}, (_, i) => i);
  shuffleArray(types);
  for (const t of types) {
    if (!wouldMatchAt(row, col, t)) return t;
  }
  return types[0]; // 保底回退
}
```

#### ✅ 边界处理

所有数组访问均有 `grid[r] && grid[r][c]` 前置检查，无越界风险。

#### ⚠️ 随机系统无权重

当前使用纯随机，没有权重系统（如 Candy Crush 会对玩家略微倾向生成有利消除）。
建议: 加入轻微的权重偏向，提升手感。

---

### 4b. 交互系统

#### ✅ 相邻交换限制

`isAdjacent()` 正确限制只允许上下左右相邻交换（无斜向）。

#### ✅ 无效交换回退

`handleMove()` 在无消除时触发反向动画回退，逻辑正确。

#### ✅ 动画期间锁定输入

`phase` 状态机（idle / animating / dropping / matching）正确拦截输入。

#### ⚠️ 取消选中无视觉反馈

点击已选中的同一宝石时，`selected = null` 静默取消，无任何动画反馈。
玩家不知道是否点击成功。

#### ✅ 触控支持

`pointerdown/pointermove/pointerup` + `touchstart/touchend` 双重覆盖，防止 300ms 延迟。

---

### 4c. 消除系统

#### ✅ 行列三消检测

`findMatches()` 分别扫描水平和垂直方向，支持 3+ 连续。

#### ✅ 四消/五消特殊宝石

`getSpecialFromMatch()` 正确生成：
- 4连横 → `LINE_H`
- 4连纵 → `LINE_V`
- 5连 → `RAINBOW`（彩虹宝石清除全部同色）
- T/L 型 → `BOMB`（3×3 范围爆炸）

#### ✅ 连锁消除（Cascade）

`processMatchChain()` 采用异步循环确保正确：
消除 → 下落 → 再检测 → 再消除，直到无新消除为止。

#### ✅ 死局自动洗牌

`hasValidMoves()` 暴力检验所有可能交换，无有效移动时 `reshuffleBoard()` 洗牌（Fisher-Yates）。

---

### 4d. 分数/能量系统

#### ✅ 分数公式合理

```
基础分 = 宝石数 × 宝石权重(10-30)
连击奖励 = 基础分 × (连击数 × 0.3)
节奏奖励 = (基础分 + 连击) × (节奏倍率 - 1)
最终得分 = 基础分 + 连击奖励 + 节奏奖励
```

#### ✅ 连击正确累积

`combo` 计数器在连锁消除期间正确累积，断链归零。

#### ✅ 关卡目标判定

`checkGameState()` 在每次 `processMatchChain()` 完成后调用，无遗漏。

---

### 4e. 关卡系统

#### ✅ 步数正确递减

`movesLeft--` 在 `handleMove()` 成功后调用，逻辑正确。

#### ✅ 胜负判定完善

- 胜利: `score >= targetScore` 且（无限步 或 步数 > 0）
- 失败: `movesLeft <= 0` 且 `score < targetScore`
- 时间攻击: 仅由计时器决定结束

#### ✅ 关卡数据可配置

`campaign.js` 通过 `getLevelConfig(globalIndex)` 动态生成，非硬编码。

#### ✅ 进度保存正确

`data.stars[globalIdx]` 使用 `globalIdx = islandIndex * 15 + localLevel`，索引计算正确。

---

### 4f. 存档系统

#### ✅ try-catch 覆盖

`_doSave()` 内有 try-catch，捕获 localStorage 空间不足错误并自动裁剪旧数据。

#### ✅ 防抖保护

1000ms 防抖 + `visibilitychange` / `pagehide` 兜底保存。

#### ✅ 存档迁移

`migrateV1()` 处理旧格式升级，`deepMerge()` 保证新字段有默认值。

#### ✅ 损坏降级

`load()` 解析失败时回退到默认值，不会崩溃。

---

## 五、附加功能模块审查

### ✅ 农场系统 (garden.js)

- 30+ 植物种类，生长计时器正确运行
- 收割/种植逻辑完整
- ⚠️ **问题**: 种子选择模态框打开时，30秒刷新计时器仍在运行，可能导致模态框背后的农场画面重渲染

### ✅ 成就系统 (daily.js)

- 触发条件与游戏事件钩子正确连接
- ⚠️ **问题**: 快速连续解锁成就时，Toast 上限逻辑有误（最多显示 4 个而非 3 个）

### ✅ 炼金工坊 (potion.js)

- 药水合成、消耗、效果应用均已实现
- 霜冻药水（非限时关卡）: +3 步数 ✅
- 暗影药水: 仅合成，无 UI 按钮（已知设计限制）

### ⚠️ 世界任务/竞技场

- 目前仅有 UI 占位骨架，无实际功能逻辑
- 玩家点击后显示"敬请期待"提示

---

## 六、性能审查

### ✅ RAF 游戏循环

使用 `requestAnimationFrame`，循环内有 try-catch 保证循环不中断。

### ✅ 音频异步加载

Web Audio API 按需创建振荡器，无阻塞主线程。

### ✅ 粒子系统内存管理

粒子数组有 MAX 上限，超出时 `splice()` 移除旧粒子，无内存增长。

### ⚠️ hasValidMoves() 性能

O(n²) 暴力检验所有交换可能（8×8 棋盘 = 512+ 次检查），在关卡开始时可能调用 100+ 次。
建议: 加入"发现第一个有效移动立即退出"的早退出优化（已部分实现，但循环结构可优化）。

### ⚠️ DOM 批量操作

`updateGameUI()` 每帧直接操作 DOM，未使用 DocumentFragment 批量更新。
建议: 用脏标记（dirty flag）仅在数值变化时更新 DOM。

---

## 七、安全审查

### ✅ 无 XSS 风险

所有动态内容通过 `textContent` 或 `canvas` 绘制，未发现危险 `innerHTML` 拼接。

### ✅ 全局变量控制良好

各模块使用 IIFE 或模块模式，核心变量未暴露到 `window`。

### ⚠️ console.log 残留

全项目约有 40+ 个 `console.log` / `console.warn` 调用，生产版本应条件性禁用。

```javascript
// 建议添加全局开关
const DEBUG = false;
const log = DEBUG ? console.log.bind(console) : () => {};
```

---

## Bug 清单（按严重程度排序）

---

### P0 — 致命 Bug（1个）

#### ✅ 🔴 P0-001: stuckTimer 变量遮蔽导致卡死检测永久失效（已修复）

**文件**: `board.js` 第 43 行 vs 第 2736 行
**类型**: 变量遮蔽（Variable Shadowing）
**影响**: 高压连锁消除场景下游戏完全卡死，无法自动恢复

```javascript
// ❌ 第 43 行：模块级声明
let stuckTimer = 0;
let integrityCheckTimer = 0;

// ❌ 第 2736 行：startLoop() 函数内重复声明（遮蔽了外层变量）
function startLoop() {
  let rafHandle = null;
  let stuckTimer = 0;         // 👈 创建了新的局部变量
  let integrityCheckTimer = 0; // 👈 外层变量永远不会被修改
  // ...
}
```

**后果**: `update()` 函数修改的是模块级 `stuckTimer`，但 `startLoop()` 的超时检测读取的是局部 `stuckTimer`（始终为 0），导致 3 秒自动恢复永远不会触发。

**修复方案**:
```javascript
// ✅ 删除 startLoop() 内的重复声明，只保留赋值
function startLoop() {
  let rafHandle = null;
  stuckTimer = 0;         // 去掉 let，赋值给外层变量
  integrityCheckTimer = 0; // 去掉 let
  // ...
}
```

---

### P1 — 严重 Bug（3个）

#### ✅ 🟠 P1-001: stuckTimer 重置逻辑错误导致 3 秒超时永远无法累积（已修复）

**文件**: `board.js` 第 2695-2710 行
**类型**: 逻辑错误
**影响**: 即使 P0 修复后，卡死恢复仍可能无法触发

```javascript
// ❌ 当前代码：只要 animations.length > 0，每帧都重置 timer
if (phase === 'animating' && animations.length === 0) {
  stuckTimer += dt;         // 只有无动画时才累积
  if (stuckTimer > 3000) { /* 恢复 */ }
} else {
  stuckTimer = 0;           // 👈 有任何动画时每帧清零
}
```

**问题**: 连锁消除时 `animations` 数组持续有内容，`stuckTimer` 被每帧清零。
如果 dropAndFill 进入无限循环（一个稀有 Bug），动画永远有内容，timer 永远为 0。

**修复方案**:
```javascript
// ✅ 仅当 phase 不在 animating 时重置
if (phase === 'animating' && animations.length === 0) {
  stuckTimer += dt;
  if (stuckTimer > 3000) { /* 恢复 */ }
} else if (phase !== 'animating') {  // 👈 修改条件
  stuckTimer = 0;
}
```

---

#### ✅ 🟠 P1-002: 农场刷新定时器在模态框打开期间仍运行（已修复）

**文件**: `app.js` 第 502-505 行 / 553-576 行
**类型**: 定时器管理缺陷
**影响**: 玩家在种子选择界面时，农场背景意外重渲染，可能造成视觉错位

```javascript
// ❌ setInterval 在模态框打开时继续触发 renderGarden()
gardenRefreshTimer = setInterval(() => {
  if (currentPage === 'garden') renderGarden(); // 模态框也在 garden 页
  else { clearInterval(gardenRefreshTimer); gardenRefreshTimer = null; }
}, 30000);
```

**修复方案**:
```javascript
// ✅ 增加模态框状态检查
gardenRefreshTimer = setInterval(() => {
  if (currentPage === 'garden' && !document.querySelector('.modal.show')) {
    renderGarden();
  } else if (currentPage !== 'garden') {
    clearInterval(gardenRefreshTimer);
    gardenRefreshTimer = null;
  }
}, 30000);
```

---

#### ✅ 🟠 P1-003: 棋盘腐败检测不完整，视觉状态异常无法被检测（已修复）

**文件**: `board.js` 第 1203-1237 行
**类型**: 检测遗漏
**影响**: `scale <= 0` 或 `alpha <= 0` 的宝石无法被检测，游戏显示空白格但不触发修复

```javascript
// ❌ 当前检测：只检查"浮空间隙"（宝石上方有空格）
function detectBoardCorruption() {
  // 只检查 floating gap，不检查视觉状态
}
```

**修复方案**: 在检测循环中增加视觉状态验证：
```javascript
// ✅ 增加视觉状态检查
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const cv = cellVisual[r]?.[c];
    if (cv && (cv.scale <= 0 || cv.alpha <= 0 || isNaN(cv.scale))) {
      return true; // 腐败
    }
  }
}
```

---

### P2 — 中等 Bug（4个）

#### ✅ 🟡 P2-001: dropAndFill() 中 cellVisual 重置逻辑不一致（已修复）

**文件**: `board.js` 第 1756-1770 行
**类型**: 视觉状态不一致
**影响**: 某些宝石下落时不从正确位置开始动画，出现瞬移感

**问题**: 写入新格时完整重置 cellVisual，但原位宝石只条件重置：
```javascript
// 新位置: 完整重置（scale/alpha/y 全部设置）✅
// 原位置: 仅当 scale/alpha 异常时才重置 ❌
```

**修复**: 统一对所有参与 dropAndFill 的格子进行完整状态重置。

---

#### ✅ 🟡 P2-002: 取消选中宝石无视觉反馈（已修复）

**文件**: `board.js` 第 2299-2305 行
**类型**: UX 缺失
**影响**: 玩家点击已选中宝石时静默取消，不知道是否操作成功

**修复**:
```javascript
} else if (selected.row === cell.row && selected.col === cell.col) {
  selected = null;
  // ✅ 增加视觉反馈
  cellVisual[cell.row][cell.col].scale = 0.85;
  setTimeout(() => {
    if (cellVisual[cell.row]?.[cell.col])
      cellVisual[cell.row][cell.col].scale = 1;
  }, 150);
  Audio.playSelect();
}
```

---

#### ✅ 🟡 P2-003: 成就 Toast 上限逻辑有误，最多显示 4 个（已修复）

**文件**: `app.js` 第 805-833 行
**类型**: 逻辑边界错误
**影响**: 快速解锁多个成就时屏幕被 Toast 堆满

```javascript
// ❌ 当前：>= 3 才移除第一个，此时已有 3 个 + 新增 1 个 = 4 个
if (existing.length >= 3) existing[0].remove();
```

**修复**:
```javascript
// ✅ >= 2 时移除，确保最多同时显示 3 个
while (document.querySelectorAll('.achievement-toast').length >= 3) {
  document.querySelector('.achievement-toast').remove();
}
```

---

#### ✅ 🟡 P2-004: resize 事件监听器未在页面离开时清除（已修复）

**文件**: `app.js` 第 94-102 行
**类型**: 轻微内存泄漏
**影响**: 每次调用 `Board.init()` 会叠加一个新的 resize 监听器

**修复**: 使用具名函数 + removeEventListener，或 AbortController：
```javascript
const ac = new AbortController();
window.addEventListener('resize', handler, { signal: ac.signal });
// 离开时: ac.abort();
```

---

### P3 — 低优先级问题（4个，均已修复）

| ID | 文件 | 问题描述 |
|----|------|---------|
| ✅ P3-001 | `board.js` | `hasValidMoves()` 改为“常数时间局部判定 + 早退出”，降低移动端开局卡顿 |
| ✅ P3-002 | `board.js` | 增加 `DEBUG` 日志开关，`console.warn` 改为条件输出，生产默认静默 |
| ✅ P3-003 | `sw.js` | `CACHE_NAME` 改为基于 `ASSETS` 自动派生，避免手工改版本号 |
| ✅ P3-004 | `campaign.js` | Boss HP 调整为非线性曲线，提升前期 Boss 压力并增强后期梯度 |

---

## 八、推荐修复优先级

```
第一优先级（今天修复，影响可玩性）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☑ P0-001  stuckTimer 变量遮蔽                    ✅ 已修复
☑ P1-001  stuckTimer 重置条件错误                ✅ 已修复

第二优先级（本周修复，影响体验质量）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☑ P1-002  农场定时器模态框问题                   ✅ 已修复
☑ P1-003  棋盘腐败检测增强                       ✅ 已修复
☑ P2-001  dropAndFill 视觉状态统一               ✅ 已修复
☑ P2-002  取消选中视觉反馈                       ✅ 已修复
☑ P2-003  成就 Toast 上限修复                    ✅ 已修复
☑ P2-004  resize 监听器清理                      ✅ 已修复

第三优先级（下个版本优化）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☑ P3-001  hasValidMoves() 早退出优化             ✅ 已修复
☑ P3-002  生产 console.log 清理                  ✅ 已修复
☑ P3-003  SW 自动版本管理                        ✅ 已修复
☑ P3-004  Boss 难度曲线优化                      ✅ 已修复
```

---

## 九、与 Candy Crush 的差距分析

| 维度 | Candy Crush | Azeroth Match | 差距 |
|------|------------|---------------|------|
| **核心消除引擎** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 连锁动画节奏感稍弱 |
| **特效质量** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 缺少全屏光效、镜头抖动等高级特效 |
| **关卡多样性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 150 关目前仅 1 种基础玩法 |
| **道具/技能系统** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 药水系统存在但缺乏策略深度 |
| **UI/动画打磨** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 字体、配色和动画节奏仍有提升空间 |
| **音效设计** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Web Audio 合成音效已相当不错 |
| **代码稳定性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 存在卡死 Bug，CC 经过数年打磨极稳 |
| **世界观/IP** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | WoW 题材独特，有粉丝基础 |
| **心流设计** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 缺少难度曲线微调，节奏感不如CC流畅 |
| **变现系统** | ⭐⭐⭐⭐⭐ | ⭐ | 无内购体系 |

### 最需要弥补的 3 个差距

1. **特效冲击力**: Candy Crush 的连击特效让玩家"爽感爆棚"。建议增加全屏闪光、镜头推拉、更强烈的连击震屏。

2. **关卡目标多样性**: 目前所有关仅"攒分"。建议增加"清除特定宝石"、"解除冰封"、"救援掉落物"等差异化目标。

3. **心流节奏调校**: Candy Crush 在玩家快输时会隐式降低难度（俗称"橡皮筋机制"）。建议增加动态难度调整。

---

## 十、总结

### 亮点（值得保留的优秀设计）

- ✅ **极强的崩溃防护**: 所有回调均有 try-catch，RAF 循环 100% 不中断
- ✅ **完善的错误恢复**: `validateAndRepairBoard()` 在 5+ 处兜底调用
- ✅ **高度创新的功能**: 天气系统 + 节奏系统 + 愤怒条 + 暗示系统，超出同类独立游戏
- ✅ **良好的内存管理**: 粒子/动画数组均有上限和自动清理
- ✅ **扎实的存档系统**: 防抖 + 迁移 + 降级处理一应俱全

### 紧急行动

**P0-P3 已完成修复（2026-03-01）** — 卡死检测、棋盘完整性、交互反馈、计时器管理、性能与缓存版本策略均已落地修复。

---

*报告生成: Claude Code · Azeroth Match v7 · 2026-03-01*
