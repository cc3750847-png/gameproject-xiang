# UI 组件清单与前端拆分计划

整理日期：2026-04-25  
目标：把当前集中在 `src/App.tsx` 的页面结构拆成可复用 UI 组件，同时不改业务逻辑、不新增后端 API。

## 1. 当前页面状态映射

| 当前状态 | UI 页面 | 说明 |
| --- | --- | --- |
| `entry` | 入口页 | 首页菜单，开始/继续/设置/成就入口 |
| `map` | 地图页 | 定位、节点 marker、节点列表、继续主线 |
| `node-detail` | 节点详情页 | 节点任务说明、开始或跳过 |
| `photo-task` | 节点任务页 | 三目标拍摄任务和明信片奖励 |
| `journey` | 主线页 | guiding、approaching、resonance、completion、handoff、finale |
| `character` | 角色页 | 头像、称号、等级、完成统计 |
| `terminal` | 终端页 | 玩家信息、成就、收藏、设置 |
| `isScannerOpen` | AR 引导层 | 全屏覆盖层，隐藏底部导航 |

## 2. 组件拆分目标

第一阶段只拆 UI shell 和表现组件，不重写状态机。

建议拆分顺序：

1. `AppShell`：负责背景、页面宽度、底部安全区、是否首页/旅程页。
2. `PageHeader`：负责 eyebrow、title、description、statusTag。
3. `BottomNav`：负责主页、地图、角色、终端四项导航。
4. `ActionButtons`：负责主按钮、次按钮、loading/disabled 状态。
5. `StatusTag`：统一状态标签颜色和尺寸。
6. `MapPage`：承接地图、节点列表、定位按钮。
7. `NodeDetailPage`：承接节点说明、任务预览、开始/跳过。
8. `NodeTaskPage`：承接目标清单、拍摄按钮、奖励卡。
9. `ArGuidanceOverlay`：承接 AR HUD、粒子层、调试面板。
10. `PlayerTerminalPage` 与 `CharacterPage`：拆出玩家档案、统计、收藏区。
11. `SettlementPage`：承接终章明信片和分享反馈。

## 3. 组件接口建议

### 3.1 AppShell

Props：

- `mode: 'home' | 'journey'`
- `children`
- `showBottomNav: boolean`
- `bottomNavProps`

职责：

- 决定背景资源。
- 控制内容最大宽度。
- 给底部导航预留安全区。

### 3.2 PageHeader

Props：

- `eyebrow: string`
- `title: string`
- `description?: string`
- `statusTag?: string`
- `statusTone?: 'default' | 'success' | 'warning' | 'error'`

职责：

- 统一每页“我在哪”的信息结构。
- 标题不超过两行。
- 状态标签固定在右上角或标题旁。

### 3.3 BottomNav

Props：

- `activeView: 'home' | 'map' | 'character' | 'terminal'`
- `onHome`
- `onMap`
- `onCharacter`
- `onTerminal`

职责：

- 统一四项导航。
- AR 打开时由父层隐藏。
- 图标资源继续使用 `public/home`。

### 3.4 MapPage

Props：

- `locationStatus`
- `nodes`
- `onRefreshLocation`
- `onOpenNode(nodeId)`
- `onContinueMainline`

节点数据：

- `id`
- `title`
- `summary`
- `distanceMeters`
- `isReachable`
- `status`

职责：

- 展示定位状态、地图节点和节点列表。
- 不处理节点任务内部逻辑。

### 3.5 NodeDetailPage

Props：

- `node`
- `taskStatus`
- `onStartTask`
- `onSkipTask`
- `onBackToMap`

职责：

- 展示节点名、文化摘要、任务预览、奖励预览。
- 明确任务可跳过。

### 3.6 NodeTaskPage

Props：

- `node`
- `task`
- `reward`
- `onCaptureTarget(target)`
- `onBackToMap`

职责：

- 展示目标清单。
- 展示完成后的奖励卡。
- 不直接写入玩家状态，由父层传入回调。

### 3.7 ArGuidanceOverlay

Props：

- `cameraStatus`
- `guidanceState`
- `particleField`
- `guidanceCopy`
- `guidanceHint`
- `audioLevel`
- `isDebugOpen`
- `onClose`
- `onToggleDebug`
- `onSetDemoDeviation`
- `onSimulateLostSignal`

职责：

- 统一 AR HUD。
- 保证关闭按钮、状态提示和扫描框始终可见。

### 3.8 RewardCard

Props：

- `title`
- `caption`
- `tone`
- `meta`
- `actionLabel?`
- `onAction?`

职责：

- 用于明信片、成就、灵韵、称号等奖励。
- 保持奖励反馈的一致结构。

### 3.9 PlayerSummary

Props：

- `nickname`
- `title`
- `avatarDataUrl?`
- `level`
- `completedCount`
- `postcardCount`
- `achievementCount`

职责：

- 在角色页和终端页复用玩家档案头部。

## 4. 静态配置整理

建议把以下配置从 `App.tsx` 移出：

- `MAP_NODES`：移至 `src/features/map-nodes/mapNodeConfig.ts`。
- `STAGE_GAME_IDS`：移至 `src/features/journey/stageGameConfig.ts`。
- 页面展示文案：保留在 `src/features/journey/screens.ts` 或拆为 `viewCopy.ts`。
- UI 状态文案：移至 `src/features/ui/statusCopy.ts`。

不在第一阶段移动：

- localStorage 玩家状态逻辑。
- AR 音频和摄像头副作用。
- API 联调调用逻辑。

## 5. 资源清单

### 5.1 已有资源

- 首页背景和标题。
- 首页四个按钮图。
- 底部导航基础图标。
- 旅程背景图。
- 角色图标试验稿。

### 5.2 需要补齐

| 优先级 | 资源 | 用途 |
| --- | --- | --- |
| P1 | 八关节点图标 | 地图 marker、节点卡、结算摘要 |
| P1 | 三身份图标 | 角色选择、玩家档案、协作提示 |
| P1 | 奖励图标 | 明信片、碎片、灵韵、称号 |
| P1 | AR 扫描角标 | AR HUD 和节点确认 |
| P2 | 节点小游戏外壳装饰 | 三个 MVP 小游戏统一入口 |
| P2 | 完成反馈纹理 | 节点完成、奖励弹层 |
| P3 | 终章海报模板 | 分享与答辩展示 |

## 6. 前端拆分验收标准

- `App.tsx` 不再直接承载大段 JSX 页面块，只负责状态组合和路由式分发。
- 每个页面组件都可以通过 props 独立理解。
- 底部导航、顶部信息区、状态标签、奖励卡不重复实现。
- 现有测试仍覆盖入口、地图、节点任务、AR、终端、结算主流程。
- 不新增后端 API，不改变现有 `/api/games/:gameId/*` 合同。

## 7. 实施批次

### 批次 1：UI Shell

- 拆出 `AppShell`、`PageHeader`、`StatusTag`、`BottomNav`、`ActionButtons`。
- 保持页面视觉不大改，先减少重复结构。

### 批次 2：页面组件

- 拆出 `MapPage`、`NodeDetailPage`、`NodeTaskPage`、`SettlementPage`。
- 将页面主内容从 `App.tsx` 转为 props 驱动。

### 批次 3：沉浸层与玩家页

- 拆出 `ArGuidanceOverlay`、`CharacterPage`、`PlayerTerminalPage`。
- 保留摄像头、音频、上传等副作用在父层或自定义 hook 中。

### 批次 4：视觉细化

- 根据 UI 规范调整 tokens、按钮、卡片、状态标签、奖励卡。
- 用浏览器检查 360px、390px、430px 和桌面预览。

