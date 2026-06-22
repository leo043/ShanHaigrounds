# ShanHaigrounds / 山海战棋

> 一款基于《山海经》神话的战棋自走棋游戏

---

## 游戏介绍

**ShanHaigrounds（山海战棋）** 是一款受《炉石传说：酒馆战棋》启发的单机战棋游戏。游戏以《山海经》神话为背景，玩家将扮演神话英雄，招募异兽、仙人、人类战士，组建强大的阵容，与其他英雄一决高下。

### 核心特色

- **神话背景**：基于《山海经》的丰富神话世界观
- **策略战棋**：招募、升级、排兵布阵，考验策略
- **自动战斗**：战斗全自动进行，专注策略决策
- **AI 对手**：智能 AI 对手，提供挑战
- **国风美术**：水墨风格界面，东方神话氛围
- **零依赖**：除开发工具外，无任何运行时依赖

---

## 技术栈

- **TypeScript** - 类型安全的 JavaScript 超集
- **Vite** - 下一代前端构建工具
- **Web Audio API** - 程序化音效生成（无需外部音频文件）

---

## 快速开始

### 环境要求

- Node.js 18.0 或更高版本
- npm 或 pnpm 包管理器

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/yourusername/ShanHaigrounds.git
cd ShanHaigrounds

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开浏览器访问 `http://localhost:5173` 即可开始游戏。

---

## 开发指南

### 可用脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 类型检查 + 生产构建
npm run lint         # 检查代码规范（ESLint）
npm run lint:fix     # 自动修复可修复的 lint 问题
npm run format       # Prettier 格式化所有源文件
npm run format:check # 检查格式是否符合规范（不修改）
npm run typecheck    # 仅 TypeScript 类型检查（不构建）
npm run test         # 运行单元测试（Vitest）
npm run test:watch   # 测试监听模式（开发时用）
```

### 代码质量护栏

项目已配置三层自动化护栏，保障代码质量：

1. **ESLint + Prettier** — 统一代码风格，捕获常见错误
2. **TypeScript 严格模式** — `strict: true` + `noUnusedLocals/Parameters`
3. **Vitest 单元测试** — 核心战斗逻辑有 14 个测试覆盖

### Git 提交规范

提交前会自动触发 Husky hooks：

- **pre-commit**：对暂存文件运行 ESLint + Prettier（lint-staged）
- **commit-msg**：校验提交信息格式（Conventional Commits）

提交信息格式：

```
<type>(<scope>): <subject>

# 示例
fix(combat): 修复金卡关键词死代码
feat(cards): 新增哪吒卡牌
docs(readme): 补充开发指南
refactor(game): 用 Effect 类型替代 any
test(combat): 补充圣盾与剧毒测试
chore: 升级依赖
```

常用 type：`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `perf` / `style`

### 测试约定

- 测试文件放在源文件旁：`src/game/combat.test.ts`
- 命名：`<模块名>.test.ts`
- 战斗测试用 `vi.spyOn(Math, 'random')` mock 随机性，确保确定性

---

## 游戏玩法

### 基础流程

1. **选择英雄**：每局开始选择一位神话英雄，每位英雄有不同的初始属性
2. **招募阶段**：消耗金币从酒馆招募随从，组建你的阵容
3. **排兵布阵**：调整随从站位，最大化战斗效果
4. **战斗阶段**：与其他英雄自动战斗，存活者获胜
5. **循环往复**：重复招募→战斗，直到决出最终胜者

### 核心机制

| 机制         | 说明                                               |
| ------------ | -------------------------------------------------- |
| **金币系统** | 每回合获得递增的金币，用于招募和升级               |
| **酒馆升级** | 提升酒馆等级，解锁更强大的随从                     |
| **三连合成** | 三个相同随从合成金色版本，获得强力奖励             |
| **随从种族** | 人族（蓝色）、妖族（紫色）、仙族（金色），各具特色 |
| **关键词**   | 嘲讽、圣盾、剧毒、风怒、复生、战吼、亡语           |

---

## 项目结构

```
ShanHaigrounds/
├── src/
│   ├── game/           # 游戏核心逻辑
│   │   ├── game.ts     # 主游戏逻辑
│   │   ├── combat.ts   # 战斗系统
│   │   ├── cards.ts    # 卡牌数据
│   │   ├── ai.ts       # AI 决策
│   │   ├── types.ts    # 类型定义
│   │   └── audio.ts    # 音效系统
│   ├── ui/             # UI 渲染
│   │   └── render.ts   # 渲染逻辑
│   ├── styles/         # 样式
│   │   └── main.css    # 主样式表
│   └── main.ts         # 入口文件
├── public/             # 静态资源
│   └── images/         # 图片资源
├── index.html          # HTML 入口
├── package.json        # 项目配置
├── tsconfig.json       # TypeScript 配置
└── vite.config.ts      # Vite 配置
```

---

## 开发计划

- [x] 核心游戏循环
- [x] 战斗系统
- [x] AI 对手
- [x] 国风 UI
- [x] 音效系统
- [ ] 英雄技能系统
- [ ] 更多卡牌
- [ ] 新手引导
- [ ] 战绩统计
- [ ] 移动端适配

---

## 贡献

欢迎提交 Issue 和 Pull Request！

---

## 许可证

[MIT](LICENSE) © 2026

---

## 致谢

- 灵感来源：《炉石传说：酒馆战棋》
- 美术风格：中国传统水墨画
- 文化背景：《山海经》

---

> 山海之间，战棋争锋！
