# 湘江文旅主线手机 Web 原型

这是一个面向湘江文旅体验场景的手机 Web 原型项目，当前聚焦于把“音乐主线引导 + AR 方向提示 + 三个节点游戏接入”串成一条可演示、可迭代的主线流程。

项目目前已经具备一套可运行的 React 原型界面、轻量后端 API 占位能力，以及面向节点游戏联调的统一接口合同，适合用于课程汇报、原型评审和后续多人协作开发。

## 当前原型重点

- 主线流程包含 `entry`、`guiding`、`approaching`、`resonance`、`completion`、`handoff`、`finale` 等核心状态页
- 提供摄像头扫描与粒子引导的轻量 AR 演示模式
- 支持“共鸣”阶段的长按完成交互
- 提供三个节点游戏的统一接口合同与本地模拟返回
- 内置基础测试，便于对关键状态切换做回归验证

## 技术栈

- Vite
- React 19
- TypeScript
- Sass
- Zustand
- Vitest + Testing Library
- ESLint + Prettier

## 本地运行

先安装依赖：

```bash
npm install
```

启动前端开发环境：

```bash
npm run dev
```

启动本地 API 服务：

```bash
npm run dev:api
```

常用脚本：

```bash
npm run build
npm run test
npm run lint
npm run format
```

说明：

- 前端默认运行在 `http://localhost:5173`
- 若需要完整体验联调流程，建议前端和 API 各开一个终端同时运行

## 接口概览

当前项目提供以下本地接口：

- `GET /api/health`
- `GET /api/journey`
- `GET /api/games/:gameId/config`
- `POST /api/games/:gameId/progress`
- `POST /api/games/:gameId/result`

节点游戏统一合同说明见：

- [docs/game-line-apis.md](docs/game-line-apis.md)

## 目录结构

```text
.
├─ api/                         # Vercel 风格接口目录
├─ docs/                        # 项目说明、接口文档、过程文档
├─ server/                      # 本地 Node API 服务
├─ src/                         # React 原型源码
│  ├─ features/                 # 按功能拆分的模块
│  ├─ styles/                   # 样式变量与主题样式
│  └─ test/                     # 测试初始化
├─ xiang-river-obsidian-vault/  # 项目 Obsidian 知识库
└─ vercel.json                  # 部署配置
```

## 文档入口

- 技术与原型沉淀：`xiang-river-obsidian-vault/`
- 游戏接口合同：[docs/game-line-apis.md](docs/game-line-apis.md)
- 协作过程文档：`docs/superpowers/`

## 仓库状态

- 当前仓库已发布到 GitHub
- 远程地址：[cc3750847-png/gameproject-xiang](https://github.com/cc3750847-png/gameproject-xiang)
- 当前仓库设置为公开仓库，便于展示与协作
