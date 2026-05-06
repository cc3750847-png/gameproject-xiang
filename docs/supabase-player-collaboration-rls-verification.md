# Supabase Player Collaboration RLS Verification

Use this checklist after applying `supabase/migrations/20260506000000_player_collaboration.sql` to the intended Supabase project.

## Dashboard Checks

- Auth anonymous sign-ins are enabled.
- Bucket `xiang-river-media` exists, is private, limits files to 8 MB, and only allows `image/png`, `image/jpeg`, and `image/webp`.
- All project-owned `public` tables have RLS enabled.
- Realtime is enabled for `rooms`, `room_members`, `member_progress`, `node_task_records`, `game_results`, `postcard_rewards`, `achievement_unlocks`, and `room_events`.
- Frontend environment variables only include `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## SQL Checks

Run in the Supabase SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'rooms',
    'room_members',
    'member_progress',
    'media_assets',
    'node_task_records',
    'game_results',
    'postcard_rewards',
    'achievement_unlocks',
    'room_events'
  )
order by tablename;
```

Expected: every row has `rowsecurity = true`.

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'rooms',
    'room_members',
    'member_progress',
    'media_assets',
    'node_task_records',
    'game_results',
    'postcard_rewards',
    'achievement_unlocks',
    'room_events'
  )
order by tablename, policyname;
```

Expected: each table has scoped `authenticated` policies for the commands it needs.

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'xiang-river-media';
```

Expected: `public = false`, `file_size_limit = 8388608`, and allowed MIME types contain PNG, JPEG, and WebP.

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in (
    'rooms',
    'room_members',
    'member_progress',
    'node_task_records',
    'game_results',
    'postcard_rewards',
    'achievement_unlocks',
    'room_events'
  )
order by tablename;
```

Expected: all listed realtime tables are present.

## Manual Two-User Checks

Use two browser sessions with two anonymous users.

1. User A creates a room with a nickname and receives a six-character room code.
2. User B searches by the room code and joins with a different nickname.
3. User B can read room members, progress summaries, and room events after joining.
4. User B cannot update User A's `room_members` or `member_progress` rows.
5. User B cannot insert node records, game results, postcard rewards, achievements, or media metadata for User A's `room_member_id`.
6. User B cannot upload to User A's Storage prefix.
7. User A can upload under `rooms/{room_id}/members/{member_id}/avatar/...`.
8. User A can upload under `rooms/{room_id}/members/{member_id}/node-photo/...`.
9. User A can upload under `rooms/{room_id}/members/{member_id}/postcard-poster/...`.

Expected result: all readable data is scoped by room membership, and all writable data is scoped by member ownership.

## Security Search Before Release

Run locally before deployment:

```bash
rg -n "SERVICE_ROLE|service_role|SUPABASE_SERVICE|VITE_.*SERVICE|anon.*secret" .
```

Expected: no frontend source or env example exposes a service role key.
