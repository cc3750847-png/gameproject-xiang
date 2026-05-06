---
tags:
  - xiang-river
  - tech
  - supabase
  - collaboration
  - plan
---

# Supabase 游客协作数据系统实施计划

更新日期：2026-05-06

## 定位

这份计划承接 [[30-Supabase游客协作数据系统设计]]，用于把当前本地演示原型升级为可上线、可保存、可游客协作的数据系统。

工程计划原文：`docs/superpowers/plans/2026-05-06-supabase-player-collaboration-implementation.md`

## 实施范围

首期做：

- Supabase 匿名登录
- 昵称 + 房间码创建 / 加入
- 房间成员、进度、节点任务、小游戏结果、明信片、成就同步
- 头像、节点照片、纪念海报上传
- 团队进度面板
- 轻实时 + 轮询兜底
- `localStorage` 离线 / 课堂演示兜底

首期不做：

- 老师 / 运营后台
- 手机号、邮箱或第三方登录
- 连续定位轨迹
- 摄像头视频流和音频上传
- 完整点击日志
- 替换现有 `/api/games/*` 合同

## 阶段顺序

1. 添加 Supabase 前端配置入口、环境变量示例和依赖。
2. 添加 Supabase schema、RLS、Storage bucket 和验证说明。
3. 添加协作类型、房间码规则和测试。
4. 添加匿名会话初始化。
5. 添加协作数据访问封装。
6. 添加云端进度与本地兜底映射。
7. 添加房间同步 Hook、轻实时和轮询兜底。
8. 添加图片上传路径和校验。
9. 在 `App.tsx` 接入创建 / 加入房间入口。
10. 同步玩家进度、节点任务、明信片、成就和小游戏结果。
11. 接入头像、节点照片和纪念海报上传。
12. 添加团队进度面板。
13. 更新 README、设计状态、Obsidian 入口并做全量验证。

## 关键文件

计划创建：

- `supabase/migrations/20260506000000_player_collaboration.sql`
- `docs/supabase-player-collaboration-rls-verification.md`
- `.env.example`
- `src/features/supabase/client.ts`
- `src/features/supabase/session.ts`
- `src/features/collaboration/types.ts`
- `src/features/collaboration/roomCode.ts`
- `src/features/collaboration/collaborationApi.ts`
- `src/features/collaboration/localFallback.ts`
- `src/features/collaboration/useCollaborationRoom.ts`
- `src/features/media/mediaUpload.ts`

计划修改：

- `.gitignore`
- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/features/player/*`
- `src/features/map-nodes/types.ts`
- `src/styles/tokens.scss`
- `README.md`
- `docs/game-line-apis.md`

## 验证方式

代码侧：

```bash
npm test
npm run build
npm run lint
```

Supabase 侧：

- 所有 public 表开启 RLS。
- 未加入房间前不能读取房间成员数据。
- 同房间成员可以读取团队进度。
- 玩家不能修改其他成员进度。
- Storage 只能上传到自己的 `room_id/member_id` 路径。

手动验证：

- 两个浏览器加入同一个房间。
- A 完成节点，B 能看到团队进度更新。
- A 上传头像或节点照片，B 能看到媒体预览。
- B 提交小游戏结果，A 能看到排行榜更新。
- 断网后本地演示流程仍可继续。

## 风险

- RLS 写错会造成跨房间读取。
- Storage 路径策略写错会造成图片越权访问。
- Supabase 匿名登录不可用时需要保留本地兜底。
- Realtime 在移动浏览器可能不稳定，所以必须保留轮询刷新。
- `src/App.tsx` 已经较大，新增逻辑必须尽量下沉到 feature 模块。
- 不得把 `SUPABASE_SERVICE_ROLE_KEY` 放入前端或 `VITE_*` 环境变量。

## 相关链接

- [[00-技术实现总览]]
- [[30-Supabase游客协作数据系统设计]]
- [[29-定位地图节点系统执行计划]]
- [[04-协作与汇报/25-三个节点游戏接入规范]]

