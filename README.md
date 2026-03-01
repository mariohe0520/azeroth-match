# ⚔️ 艾泽拉斯消消乐 — Azeroth Match

> 魔兽世界主题的消消乐 RPG，专为 iOS Safari 优化，可离线游玩。

---

## 在线体验

**GitHub Pages**: [mariohe0520.github.io/azeroth-match](https://mariohe0520.github.io/azeroth-match)

---

## 游戏特色

| 特色 | 描述 |
|------|------|
| 🗺️ **150 关冒险** | 10 个 WoW 大区 × 15 关，逐步解锁 |
| 🏰 **7 种族棋子** | 人类/兽人/暗夜精灵/亡灵/牛头人/矮人/巨龙 |
| ⚡ **特殊宝石** | 横线风暴、纵向雷击、奥术爆破、虹彩清除 |
| 🌦️ **天气系统** | 黎明→白天→黄昏→夜晚动态背景渐变 |
| 🎵 **节奏系统** | 规律操作触发节奏加成，音效随连击升调 |
| 😤 **愤怒条 + Boss** | 消除积累怒气，大招对抗区域 Boss |
| 💡 **智能暗示** | 超时自动提示，支持连锁消除预览 |
| 🌿 **农场系统** | 要塞草药农场，培育 30+ 种植物 |
| ⚗️ **炼金工坊** | 合成药水，强化每关能力 |
| 🏆 **成就系统** | 解锁 WoW 主题成就，永久记录 |

---

## 技术栈

- **核心**: 纯 Vanilla JS + HTML5 Canvas，零依赖，零构建
- **渲染**: Canvas 2D + requestAnimationFrame
- **音效**: Web Audio API 程序化合成（无需外部音频文件）
- **存储**: LocalStorage（防抖写入 + 版本迁移）
- **PWA**: Service Worker（网络优先 + 自动哈希版本管理）
- **平台**: iOS Safari / Chrome / PWA 安装

---

## 项目结构

```
azeroth-match/
├── index.html          主入口 HTML
├── sw.js               Service Worker（自动哈希版本）
├── manifest.json       PWA 清单
├── css/
│   ├── style.css       主样式（WoW 暗金配色）
│   └── animations.css  动画关键帧
├── js/
│   ├── board.js        核心引擎（棋盘/消除/动画/输入）⭐ 2900+ 行
│   ├── app.js          页面路由 + 关卡管理 + UI 回调
│   ├── campaign.js     10 大区 × 15 关卡数据 + Boss 配置
│   ├── gems.js         7 种族宝石渲染（Emoji 预缓存）
│   ├── effects.js      粒子/爆炸/愤怒条/连锁特效
│   ├── audio.js        Web Audio 合成音效系统
│   ├── garden.js       草药农场迷你游戏
│   ├── potion.js       炼金药水合成
│   ├── storage.js      防抖 LocalStorage + deepMerge 迁移
│   ├── daily.js        每日挑战 + 成就系统
│   └── story.js        故事年鉴
└── www/                GitHub Pages 镜像（与根目录同步）
```

---

## 本地运行

直接用浏览器打开 `index.html` 即可，无需服务器，无需 npm。

```bash
# macOS
open index.html

# 或启动本地服务（PWA 功能需 HTTPS / localhost）
python3 -m http.server 8080
# 访问 http://localhost:8080
```

---

## 部署

```bash
git add -A
git commit -m "feat: ..."
git push
# GitHub Pages 自动构建，约 1 分钟生效
```

> **注意**: 修改 `js/` 或 `css/` 后同步更新 `www/` 目录，Service Worker 版本自动更新。

---

## 版本历史

详见 [CHANGELOG.md](./CHANGELOG.md)

**当前版本**: v8.0.0（2026-03-01）— 全面审计 + Bug 修复 + 视觉体验提升
