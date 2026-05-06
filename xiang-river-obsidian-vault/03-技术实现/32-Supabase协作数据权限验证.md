---
tags:
  - xiang-river
  - tech
  - supabase
---

# Supabase 协作数据权限验证

这份笔记同步自项目文档 `docs/supabase-player-collaboration-rls-verification.md`，用于在 Supabase migration 应用后检查游客 / 玩家协作数据系统的 RLS、Storage 和 Realtime 配置。

## 关联文档

- [[30-Supabase游客协作数据系统设计]]
- [[31-Supabase游客协作数据系统实施计划]]
- 项目验证文档：`docs/supabase-player-collaboration-rls-verification.md`
- Migration：`supabase/migrations/20260506000000_player_collaboration.sql`

## 必查项

- Supabase Auth 已启用匿名登录。
- `xiang-river-media` bucket 为 private。
- `rooms`、`room_members`、`member_progress`、`media_assets`、`node_task_records`、`game_results`、`postcard_rewards`、`achievement_unlocks`、`room_events` 全部启用 RLS。
- Realtime 已覆盖房间、成员、进度、节点记录、小游戏结果、明信片、成就和房间事件。
- 前端只出现 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`。

## 双用户验证

用两个匿名浏览器会话验证：

1. 用户 A 创建房间。
2. 用户 B 用房间码加入。
3. 加入前，B 不能读取 A 的成员私有行。
4. 加入后，B 可以读取同房间的成员、进度摘要和事件。
5. B 不能修改 A 的成员资料或进度。
6. B 不能写入 A 的节点记录、小游戏结果、明信片、成就或媒体元数据。
7. B 不能上传到 A 的 Storage 路径。

## 发布前搜索

```bash
rg -n "SERVICE_ROLE|service_role|SUPABASE_SERVICE|VITE_.*SERVICE|anon.*secret" .
```

预期：前端源码和 env 示例中没有 service role key。
