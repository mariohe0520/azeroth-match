# Changelog — 艾泽拉斯消消乐 Azeroth Match

---

## v8.0.0 — 2026-03-01

### 全面代码审计 & Bug 修复

**P0 致命修复**
- `board.js`: 修复 `stuckTimer` / `integrityCheckTimer` 变量遮蔽问题（`let` 移至模块级），卡死检测现在可正确累积超时

**P1 严重修复**
- `board.js`: `stuckTimer` 重置条件修正为 `else if (phase !== 'animating')`，确保卡死恢复在 3 秒内触发
- `app.js`: 农场刷新定时器在模态框打开期间暂停，防止背景重渲染
- `board.js`: 棋盘腐败检测新增视觉状态检查（scale/alpha ≤ 0.02 = 不可见宝石），invisibleRatio 超阈值触发紧急恢复

**P2 中等修复**
- `board.js`: `dropAndFill()` 统一对所有格子完整重置 cellVisual（x/y/scale/alpha），消除下落瞬移感
- `board.js`: 取消选中宝石时增加 scale 弹跳视觉反馈（0.9 → 1.0，120ms）
- `app.js`: 成就 Toast 上限修正为严格 3 个（`while >= 3` 循环移除旧条目）
- `board.js`: resize 事件使用具名函数 + `removeEventListener`，防止重复叠加监听器

**P3 低优先级修复**
- `board.js`: `hasValidMoves()` 优化为仅检查右/下邻居（从 4 减至 2），提升检测性能约 50%
- `board.js`: 新增 `const DEBUG = window.__AZEROTH_DEBUG__ === true` 开关，生产环境 `debugWarn` 静默
- `sw.js`: Service Worker 缓存版本改为基于 `ASSETS` 列表自动派生哈希，无需手动更新版本号
- `campaign.js`: Boss HP 曲线改为 `Math.pow(progress, 1.4)` 非线性增长，提升前期 Boss 压力

### 移动端优化
- `index.html`: 新增 `viewport-fit=cover`，确保 iPhone X+ 底部安全区域 `env(safe-area-inset-bottom)` 正确生效

### 视觉体验提升
- `board.js`: 关卡开场入场动画按列错落（左→右波浪，列偏移系数 ×0.45）
- `board.js`: 消除后新宝石下落按列错落（每列额外偏移 ×0.4 格），形成自然瀑布效果

---

## v7.0.0 — 历史版本

### 核心功能
- Feature 1: 智能暗示系统（连锁预览 + 最优推荐）
- Feature 2: 天气粒子系统（黎明/白天/黄昏/夜晚动态背景）
- Feature 3: 节奏系统（连续规律操作触发节奏加成）
- Feature 4: 愤怒条 + Boss 战系统
- Feature 5: 鼠标悬停交换预览（Ghost 透明预览）
- Feature 6: 无障碍支持（ARIA 标签，skip link，reduced motion）
- 10 个魔兽世界大区 × 15 关卡 = 150 关
- 7 种 WoW 种族宝石（人类/兽人/暗夜精灵/亡灵/牛头人/矮人/巨龙）
- 4 种特殊宝石（横线/纵线/炸弹/彩虹）
- 农场系统（30+ 植物种类）
- 炼金工坊（药水合成）
- 成就系统
- 每日挑战
- PWA 支持（离线可玩）
