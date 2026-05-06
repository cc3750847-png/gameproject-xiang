---
tags:
  - xiang-river
  - tech
  - supabase
  - collaboration
---

# Supabase 游客协作数据系统设计

更新日期：2026-05-06

## 定位

这份设计用于把当前“本地演示原型”升级为可上线、可保存、可多人协作的数据系统。首期只面向游客 / 玩家协作，不先做老师后台或运营后台。

已确认方向：

- 多人协作对象：游客 / 玩家
- 进入方式：昵称 + 房间码
- 同步强度：轻实时
- 保存范围：核心进度 + 图片上传
- 房间创建：任何游客都能创建房间
- 技术路线：混合 Supabase 接入

工程原文：`docs/superpowers/specs/2026-05-06-supabase-player-collaboration-design.md`

## 推荐架构

采用混合方案：

- 前端直接使用 Supabase 处理匿名身份、房间、成员、进度、图片上传和团队状态。
- 现有 `/api/games/*` 三节点游戏合同继续保留。
- 小游戏结果返回后，再同步写入 Supabase。
- `localStorage` 继续作为离线和课堂演示兜底。

这样可以不打乱现有主线中枢和三个节点小游戏协作接口，又能把真实数据能力补上。

## 首期数据表

- `rooms`：协作房间，保存房间码、创建者、状态和过期时间。
- `room_members`：房间成员，保存昵称、头像、身份、当前阶段和最后活跃时间。
- `member_progress`：玩家在房间内的主线阶段、地图节点状态、明信片和成就快照。
- `node_task_records`：节点任务记录，保存进入节点、拍照、完成或跳过。
- `game_results`：三个节点小游戏的分数、通过状态和解锁结果。
- `postcard_rewards`：明信片收藏。
- `achievement_unlocks`：成就解锁记录。
- `media_assets`：头像、节点照片和纪念海报的 Storage 元数据。
- `room_events`：轻量事件流，用于团队动态和轻实时刷新。

首期不保存连续定位轨迹、摄像头视频流、音频数据或完整点击日志。

## 权限模型

所有 public 表都开启 RLS。

基本规则：

- 游客首次进入时使用 Supabase 匿名登录，得到 `auth.uid()`。
- 游客可以创建房间。
- 游客可以凭房间码加入未过期房间。
- 玩家只能修改自己的成员档案、进度、图片和小游戏结果。
- 同房间成员可以读取彼此昵称、头像、阶段、节点进度、明信片、成就和排行榜数据。
- Storage 使用私有 bucket，路径按 `room_id/member_id` 分区。
- 服务端密钥只允许放在 Vercel API 环境变量里，不进入前端。

## 图片范围

首期支持三类图片：

- 玩家头像
- 节点拍照任务图片
- 终章纪念海报

建议 bucket：

- `xiang-river-media`

建议路径：

- `rooms/{room_id}/members/{room_member_id}/avatar/{asset_id}.{ext}`
- `rooms/{room_id}/members/{room_member_id}/node-photos/{node_id}/{target_id}-{asset_id}.{ext}`
- `rooms/{room_id}/members/{room_member_id}/posters/{postcard_id}-{asset_id}.{ext}`

## 轻实时

订阅同一房间内的：

- `room_members`
- `member_progress`
- `node_task_records`
- `game_results`
- `postcard_rewards`
- `achievement_unlocks`
- `room_events`

如果 WebSocket 不稳定，则降级为 5 到 10 秒轮询。

## 前端拆分方向

不要继续把逻辑堆进 `src/App.tsx`。建议新增：

- `src/features/supabase/client.ts`
- `src/features/supabase/session.ts`
- `src/features/collaboration/types.ts`
- `src/features/collaboration/roomCode.ts`
- `src/features/collaboration/collaborationApi.ts`
- `src/features/collaboration/useCollaborationRoom.ts`
- `src/features/collaboration/localFallback.ts`
- `src/features/media/mediaUpload.ts`

现有 `map-nodes`、`player`、`journey`、`server/gameApi.js` 和 `api/games/*` 继续保留。

## 用户流程

### 首次打开

1. 恢复本地 `localStorage` 玩家状态。
2. 初始化 Supabase client。
3. 恢复 Supabase session，若没有则匿名登录。
4. 展示创建房间 / 加入房间入口。

### 创建房间

1. 输入昵称。
2. 生成 6 位房间码。
3. 写入 `rooms`。
4. 写入创建者 `room_members`。
5. 写入 `member_progress`。
6. 写入 `room_events`。
7. 缓存当前房间到 `localStorage`。

### 加入房间

1. 输入昵称和房间码。
2. 查找未过期房间。
3. 写入或恢复 `room_members`。
4. 写入或恢复 `member_progress`。
5. 开始订阅房间数据。

### 完成节点任务

1. 沿用现有节点任务逻辑。
2. 如有图片则上传 Storage。
3. 写入 `media_assets`。
4. 写入 `node_task_records`。
5. 更新 `member_progress.node_states`。
6. 写入明信片和成就。
7. 写入 `room_events`。

### 提交小游戏结果

1. 现有 `/api/games/*` 合同返回结果。
2. 写入 `game_results`。
3. 如通过则更新主线阶段。
4. 写入 `room_events`。

## 环境变量

前端：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

服务端预留：

- `SUPABASE_SERVICE_ROLE_KEY`

不要把 `service_role` 放进 `VITE_*` 变量。

## 实施顺序

1. 建 Supabase schema、RLS、索引、Storage bucket。
2. 接入 Supabase client 和匿名登录。
3. 做房间创建 / 加入。
4. 同步玩家进度、节点任务、成就、明信片、小游戏结果。
5. 接入头像、节点照片和纪念海报上传。
6. 做团队进度页、成员列表、节点完成摘要和排行榜。
7. 加轻实时订阅和轮询兜底。
8. 保留 localStorage 离线演示路径并补测试。

## 相关链接

- [[00-技术实现总览]]
- [[22-技术栈与前期环境]]
- [[29-定位地图节点系统执行计划]]
- [[04-协作与汇报/25-三个节点游戏接入规范]]

