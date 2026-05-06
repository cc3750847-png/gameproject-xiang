# Supabase Player Collaboration Data System Design

Updated: 2026-05-06

## Summary

This design turns the current Xiang River mobile Web prototype from a local-only demo into an online, saveable, player-collaborative data system. The first production-facing version focuses on visitor/player collaboration, not admin authoring. Players enter with a nickname and room code, share lightweight team progress, save individual route progress, upload required images, and keep the existing local demo fallback.

The recommended architecture is a mixed Supabase integration:

- Vite React frontend talks directly to Supabase for player identity, rooms, progress, media upload, team state, and lightweight realtime updates.
- Existing `/api/games/*` contracts remain in place for the three node games, then game completion is also synced into Supabase.
- `localStorage` remains as an offline and classroom-demo fallback, but Supabase becomes the cloud source of truth once a player joins a room.

## Confirmed Requirements

- Collaboration target: visitors and players.
- Entry model: nickname plus room code.
- Room creation: any visitor can create a room.
- Sync model: light realtime. Data updates when players enter rooms, complete tasks, submit game results, upload media, or refresh. Team surfaces should update within a few seconds.
- Stored data: core progress plus uploaded images.
- Media scope: avatar, node photo task images, and final commemorative poster.
- Privacy boundary: do not store continuous GPS tracks, raw AR camera streams, audio data, or detailed interaction logs in the first version.

## Non-Goals

- No teacher/admin dashboard in the first version.
- No formal phone, email, or third-party login in the first version.
- No strong realtime multiplayer movement or live teammate position tracking.
- No analytics-grade clickstream or continuous location history.
- No replacement of the existing stage-game API contract during the first pass.

## Current Project Context

The current app is a Vite, React 19, TypeScript prototype. It already has:

- Local player state in `localStorage` under `xiang-river-player`.
- Main journey stages and map node tasks in `src/App.tsx` and `src/features/*`.
- Mock game contract payloads in `server/gameApi.js`.
- Vercel-style routes under `api/`.
- Node photo task, postcard reward, achievement, avatar, terminal, and settlement flows.

There is no current `@supabase/supabase-js` dependency, no Supabase client code, and no existing Supabase schema in the repository.

## Approach Options

### Option 1: Supabase Direct Frontend

The frontend uses `@supabase/supabase-js` directly for all reads, writes, Realtime subscriptions, and Storage uploads.

Pros:

- Fastest to build.
- Works well with static Vite deployment.
- Reduces custom API surface.

Cons:

- Requires careful Row Level Security policies.
- Business validation is split between frontend and database constraints/RPCs.

### Option 2: Vercel API as Supabase Gateway

The frontend calls `/api/*`; API routes validate requests and use Supabase server credentials.

Pros:

- Centralized validation and permissions.
- Easier to hide privileged server operations.

Cons:

- Much more API code.
- Larger change to the current prototype.
- More serverless runtime concerns.

### Option 3: Mixed Integration

The frontend talks directly to Supabase for room, member, progress, media, and team state. Existing `/api/games/*` routes remain as the game contract surface, while final game results are mirrored into Supabase.

Pros:

- Fits the current project with minimal disruption.
- Keeps collaborator-facing game contracts stable.
- Uses Supabase where it is strongest: Auth, Postgres, Storage, Realtime.
- Avoids overbuilding a custom backend too early.

Cons:

- Requires a clear boundary between local mock game APIs and cloud persistence.
- Requires both frontend sync code and database security policies.

Recommendation: use Option 3 for the first online version.

## Auth Model

Use Supabase anonymous sign-ins for visitors.

Flow:

1. On first app open, call `supabase.auth.signInAnonymously()` if no active Supabase session exists.
2. Create or restore a local device profile from `localStorage`.
3. Ask the visitor for a nickname before room creation or joining.
4. Store room membership against `auth.uid()` and nickname.
5. Keep `localStorage` as a cache and fallback for disconnected demo mode.

Important behavior:

- Anonymous users are real authenticated users for RLS purposes.
- A nickname is display identity, not authorization identity.
- A visitor can later rejoin from the same browser session if Supabase session and local cache remain.

References:

- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

## Database Model

All tables should live in `public` for the first version, with RLS enabled on every table.

### `rooms`

Purpose: one collaborative play session.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `room_code text not null unique`
- `created_by uuid not null references auth.users(id)`
- `title text`
- `status text not null default 'active'`
- `expires_at timestamptz not null`
- `archived_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `status in ('active', 'expired', 'archived')`
- `room_code` is uppercase, short, and human-readable. Use six characters for classroom use.

### `room_members`

Purpose: one player inside one room.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id)`
- `nickname text not null`
- `avatar_asset_id uuid references media_assets(id)`
- `identity_id text`
- `current_stage text not null default 'entry'`
- `is_creator boolean not null default false`
- `last_active_at timestamptz not null default now()`
- `joined_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- Unique `(room_id, user_id)`
- `nickname` length between 1 and 24 after trimming.

### `member_progress`

Purpose: current player journey state in a room.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `room_member_id uuid not null references room_members(id) on delete cascade`
- `journey_stage text not null default 'entry'`
- `active_view text`
- `selected_node_id text`
- `map_refreshed boolean not null default false`
- `node_states jsonb not null default '{}'::jsonb`
- `achievement_ids text[] not null default '{}'`
- `postcard_ids text[] not null default '{}'`
- `updated_at timestamptz not null default now()`

Constraints:

- Unique `room_member_id`

Notes:

- `node_states` stores compact task state keyed by node id, such as captured target ids, skipped status, completed status, and completed timestamp.
- Detailed records still go into `node_task_records`, but this snapshot makes frontend restore fast.

### `node_task_records`

Purpose: auditable task records for map nodes and photo goals.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references rooms(id) on delete cascade`
- `room_member_id uuid not null references room_members(id) on delete cascade`
- `node_id text not null`
- `target_id text`
- `action text not null`
- `media_asset_id uuid references media_assets(id)`
- `captured_count integer not null default 0`
- `created_at timestamptz not null default now()`

Constraints:

- `action in ('entered', 'captured', 'completed', 'skipped')`

### `game_results`

Purpose: saved results from the three node games.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references rooms(id) on delete cascade`
- `room_member_id uuid not null references room_members(id) on delete cascade`
- `game_id text not null`
- `stage_id text not null`
- `score integer not null default 0`
- `passed boolean not null default false`
- `duration_ms integer not null default 0`
- `completed_objectives text[] not null default '{}'`
- `next_stage_unlocked text`
- `raw_payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Constraints:

- `game_id in ('river-sound', 'island-light', 'memory-resonance')`

### `postcard_rewards`

Purpose: persistent postcard collection.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references rooms(id) on delete cascade`
- `room_member_id uuid not null references room_members(id) on delete cascade`
- `node_id text not null`
- `postcard_id text not null`
- `title text not null`
- `caption text`
- `image_tone text`
- `poster_asset_id uuid references media_assets(id)`
- `earned_at timestamptz not null default now()`

Constraints:

- Unique `(room_member_id, postcard_id)`

### `achievement_unlocks`

Purpose: normalized achievement history.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references rooms(id) on delete cascade`
- `room_member_id uuid not null references room_members(id) on delete cascade`
- `achievement_id text not null`
- `source_event text`
- `unlocked_at timestamptz not null default now()`

Constraints:

- Unique `(room_member_id, achievement_id)`

### `media_assets`

Purpose: metadata for Storage objects.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references rooms(id) on delete cascade`
- `room_member_id uuid not null references room_members(id) on delete cascade`
- `kind text not null`
- `bucket text not null`
- `object_path text not null unique`
- `mime_type text`
- `size_bytes integer`
- `width integer`
- `height integer`
- `created_at timestamptz not null default now()`

Constraints:

- `kind in ('avatar', 'node-photo', 'postcard-poster')`

### `room_events`

Purpose: lightweight team activity and realtime refresh.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references rooms(id) on delete cascade`
- `room_member_id uuid references room_members(id) on delete set null`
- `event_type text not null`
- `node_id text`
- `game_id text`
- `payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Example event types:

- `room-created`
- `member-joined`
- `stage-updated`
- `node-entered`
- `node-photo-captured`
- `node-completed`
- `node-skipped`
- `game-result-submitted`
- `postcard-earned`
- `achievement-unlocked`

## RLS Model

Enable RLS on every public table.

Helper concept:

- A user can read a room if they are a member of that room.
- A user can write member-owned rows if `room_members.user_id = auth.uid()`.
- A user can create a room as themselves.
- A user can join an active, unexpired room by `room_code`.

Policies:

### `rooms`

- Insert: authenticated users can create a room with `created_by = auth.uid()`.
- Select: authenticated users can select rooms they created or rooms where they are members.
- Update: room creator can update title/status; system expiration can be handled by scheduled maintenance later.

### `room_members`

- Insert: authenticated users can insert their own member row for an active room.
- Select: authenticated users can read members in rooms they belong to.
- Update: users can update their own nickname, avatar, identity, current stage, and last active time.

### `member_progress`

- Insert/update: member owner only.
- Select: members of the same room can read team progress.

### `node_task_records`, `game_results`, `postcard_rewards`, `achievement_unlocks`, `media_assets`, `room_events`

- Insert: member owner only.
- Select: members of the same room can read.
- Update/delete: avoid broad update/delete in first version. Prefer append-only records, with snapshot updates limited to `member_progress`.

Reference:

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Storage Model

Create one private bucket:

- `xiang-river-media`

Object path convention:

- `rooms/{room_id}/members/{room_member_id}/avatar/{asset_id}.{ext}`
- `rooms/{room_id}/members/{room_member_id}/node-photos/{node_id}/{target_id}-{asset_id}.{ext}`
- `rooms/{room_id}/members/{room_member_id}/posters/{postcard_id}-{asset_id}.{ext}`

Rules:

- A member can upload only under their own `room_id/member_id` prefix.
- Same-room members can view media metadata and obtain signed URLs.
- The frontend should not expose service role keys.
- Maximum file size should be enforced client-side and, where possible, bucket-side. Start with 2 MB for avatar and 8 MB for task/poster images.

Reference:

- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)

## Realtime Model

Use light realtime, backed by Supabase Realtime Postgres changes.

Subscribe per room to:

- `room_members`
- `member_progress`
- `node_task_records`
- `game_results`
- `postcard_rewards`
- `achievement_unlocks`
- `room_events`

Expected behavior:

- Team page updates member list, stage labels, node completion, and leaderboard within a few seconds.
- If subscription fails or the tab sleeps, the frontend falls back to polling every 5 to 10 seconds while the room page is open.

Reference:

- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

## Frontend Architecture

Add focused modules instead of expanding `src/App.tsx` further.

Planned modules:

- `src/features/supabase/client.ts`: creates browser Supabase client from Vite env vars.
- `src/features/supabase/session.ts`: anonymous sign-in and session restore helpers.
- `src/features/collaboration/types.ts`: room, member, progress, media, and event types.
- `src/features/collaboration/roomCode.ts`: room code generation and validation.
- `src/features/collaboration/collaborationApi.ts`: Supabase read/write wrappers.
- `src/features/collaboration/useCollaborationRoom.ts`: React hook for active room state, realtime subscriptions, and polling fallback.
- `src/features/collaboration/localFallback.ts`: local cache bridge between existing player state and room state.
- `src/features/media/mediaUpload.ts`: upload and signed URL helpers.

Keep existing domain modules:

- `src/features/map-nodes/*`
- `src/features/player/*`
- `src/features/journey/*`
- `server/gameApi.js`
- `api/games/*`

## User Flow

### First Open

1. App loads.
2. Restore local player state from `localStorage`.
3. Initialize Supabase client.
4. Restore Supabase session or sign in anonymously.
5. Show room entry controls.

### Create Room

1. Visitor enters nickname.
2. App generates a room code.
3. Insert `rooms`.
4. Insert creator `room_members`.
5. Insert `member_progress`.
6. Insert `room_events` with `room-created` and `member-joined`.
7. Cache active room in `localStorage`.

### Join Room

1. Visitor enters nickname and room code.
2. Query active room by code.
3. Insert or restore `room_members`.
4. Insert or restore `member_progress`.
5. Insert `room_events` with `member-joined`.
6. Start room subscriptions.

### Complete Node Task

1. Existing task logic updates UI.
2. Upload photo if selected.
3. Insert `media_assets`.
4. Insert `node_task_records`.
5. Update `member_progress.node_states`.
6. Insert `room_events`.
7. Award postcard and achievements as needed.

### Submit Game Result

1. Existing game API contract still returns result.
2. App inserts `game_results`.
3. Update `member_progress.journey_stage` if stage unlocks.
4. Insert `room_events`.

## Environment Variables

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server only, if future Vercel routes need privileged tasks:

- `SUPABASE_SERVICE_ROLE_KEY`

Do not expose service role keys in frontend code or `VITE_*` variables.

## Room Lifecycle

Because any visitor can create rooms, the first version should prevent clutter:

- Default `expires_at` is 24 hours after creation.
- Expired rooms are hidden from join lookup.
- Existing members can still see a local cached expired room with a message that it can no longer accept writes.
- Cleanup can be a later scheduled job or manual Supabase dashboard action.

## Privacy and Safety

- Do not store continuous GPS tracks.
- Store only node-level task records and final submitted results.
- Do not upload camera streams.
- Uploaded photos should be user-initiated only.
- The UI should explain that photos and avatars are stored for the shared room experience.
- Restrict read access to same-room members through RLS.

## Testing Strategy

Unit tests:

- Room code generation and validation.
- Collaboration API payload normalization.
- Local fallback merge behavior.
- Progress snapshot conversion from current player/map state.

Integration tests:

- Create room flow with mocked Supabase client.
- Join room flow with mocked active room.
- Node completion writes records and updates progress.
- Game result sync preserves existing `/api/games/*` contract.

Manual verification:

- Two browsers join the same room.
- Player A completes a node; Player B sees progress update.
- Player A uploads avatar and node photo; Player B sees signed media preview.
- Offline mode continues with `localStorage` fallback.

Database verification:

- RLS rejects reading a room before joining.
- RLS allows same-room member reads.
- RLS rejects writing another member's progress.
- Storage policy rejects upload outside member prefix.

## Rollout Plan

Phase 1: schema and RLS

- Create tables, indexes, RLS policies, grants, and Storage bucket.
- Verify with simple SQL and Supabase dashboard.

Phase 2: frontend foundation

- Add Supabase client.
- Add anonymous sign-in.
- Add room create/join UI state.
- Keep local-only demo path available.

Phase 3: persistence sync

- Sync player profile, stage, map node state, achievements, postcards, and game results.
- Add local fallback and conflict rules.

Phase 4: media upload

- Upload avatars, task photos, and posters.
- Store metadata in `media_assets`.
- Render signed URLs.

Phase 5: team surfaces

- Add team progress panel, room code sharing, members list, node completion summary, and leaderboard.
- Add light realtime and polling fallback.

## Open Implementation Decisions

These should be resolved during implementation planning:

- Exact shape of `node_states` JSON snapshot.
- Whether poster generation is client canvas export or server-generated later.
- Whether expired rooms become read-only or hidden entirely.
- Whether room code collision retry lives in the client or a database RPC.

## Approval

The user approved this direction on 2026-05-06:

- Visitors/players collaboration.
- Nickname plus room code.
- Light realtime.
- Core progress plus image upload.
- Any visitor can create rooms.
- Mixed Supabase integration.

