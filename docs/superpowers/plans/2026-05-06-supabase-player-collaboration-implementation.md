# Supabase Player Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Xiang River mobile Web prototype into an online, saveable, visitor/player collaboration system using Supabase while preserving the current local demo fallback and existing `/api/games/*` contract.

**Architecture:** Use the approved mixed integration: React talks directly to Supabase for anonymous identity, rooms, member progress, media upload, team state, and light realtime; the current game API contract stays intact and only mirrors final game results into Supabase. Keep new Supabase and collaboration logic in focused `src/features/supabase/`, `src/features/collaboration/`, and `src/features/media/` modules so `src/App.tsx` only coordinates UI state.

**Tech Stack:** Vite, React 19, TypeScript, Vitest, Testing Library, Supabase Auth anonymous sign-ins, Supabase Postgres with RLS, Supabase Storage, Supabase Realtime.

---

## Scope

In scope:

- Supabase schema, indexes, RLS policies, grants, Realtime publication, and private media bucket plan.
- Anonymous Supabase session bootstrap.
- Nickname plus room code create/join flow.
- Player progress, node task, postcard, achievement, and game result sync.
- Avatar, node photo, and commemorative poster upload flow.
- Team progress surface with light realtime and polling fallback.
- Local `localStorage` demo fallback.

Out of scope:

- Teacher/admin dashboard.
- Formal phone, email, or third-party login.
- Continuous location tracking.
- Raw camera stream or audio upload.
- Full clickstream analytics.
- Replacing the existing `/api/games/*` contract.

## File Map

Create:

- `supabase/migrations/20260506000000_player_collaboration.sql`
- `docs/supabase-player-collaboration-rls-verification.md`
- `.env.example`
- `src/features/supabase/client.ts`
- `src/features/supabase/client.test.ts`
- `src/features/supabase/session.ts`
- `src/features/supabase/session.test.ts`
- `src/features/collaboration/types.ts`
- `src/features/collaboration/roomCode.ts`
- `src/features/collaboration/roomCode.test.ts`
- `src/features/collaboration/collaborationApi.ts`
- `src/features/collaboration/collaborationApi.test.ts`
- `src/features/collaboration/localFallback.ts`
- `src/features/collaboration/localFallback.test.ts`
- `src/features/collaboration/useCollaborationRoom.ts`
- `src/features/collaboration/useCollaborationRoom.test.tsx`
- `src/features/media/mediaUpload.ts`
- `src/features/media/mediaUpload.test.ts`

Modify:

- `.gitignore`
- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/features/player/types.ts`
- `src/features/player/playerState.ts`
- `src/features/player/playerState.test.ts`
- `src/features/map-nodes/types.ts`
- `src/styles/tokens.scss`
- `README.md`
- `docs/game-line-apis.md`

Do not modify:

- `server/gameApi.js` contract shape unless a test proves the mirror payload needs an added optional field.
- Existing generated binary assets.
- Existing unrelated modified files in the working tree.

## Supabase Documentation Baseline

Before implementation, confirm current docs and changelog:

- Supabase anonymous sign-ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Realtime Postgres changes: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase changelog: https://supabase.com/changelog

Implementation note: public tables must enable RLS and explicitly grant access to `authenticated` where Data API access is needed. Keep `service_role` out of frontend code and out of all `VITE_*` variables.

---

### Task 1: Add Supabase Project Configuration Guardrails

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/supabase/client.ts`
- Create: `src/features/supabase/client.test.ts`

- [ ] **Step 1: Write failing client config tests**

Create `src/features/supabase/client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

describe('supabase client configuration', () => {
  it('reports missing env vars without exposing secrets', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const { getSupabaseConfigStatus } = await import('./client');

    expect(getSupabaseConfigStatus()).toEqual({
      configured: false,
      missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    });
  });

  it('accepts public Supabase frontend env vars', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key');

    const { getSupabaseConfigStatus } = await import('./client');

    expect(getSupabaseConfigStatus()).toEqual({ configured: true, missing: [] });
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
npm test -- src/features/supabase/client.test.ts
```

Expected: fail because `src/features/supabase/client.ts` does not exist.

- [ ] **Step 3: Add Supabase dependency and env guard files**

Run:

```bash
npm install @supabase/supabase-js
```

Modify `.gitignore` by adding:

```gitignore
.env
.env.local
.env.*.local
```

Create `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Expected: `package.json` and `package-lock.json` include `@supabase/supabase-js`.

- [ ] **Step 4: Implement the Supabase browser client helper**

Create `src/features/supabase/client.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type SupabaseConfigStatus = {
  configured: boolean;
  missing: string[];
};

let browserClient: SupabaseClient | null = null;

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missing = [
    ['VITE_SUPABASE_URL', SUPABASE_URL],
    ['VITE_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    configured: missing.length === 0,
    missing,
  };
}

export function getSupabaseClient() {
  const status = getSupabaseConfigStatus();

  if (!status.configured) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
```

- [ ] **Step 5: Run the focused test and verify green**

Run:

```bash
npm test -- src/features/supabase/client.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env.example package.json package-lock.json src/features/supabase/client.ts src/features/supabase/client.test.ts
git commit -m "feat: 添加 Supabase 前端配置入口"
```

---

### Task 2: Add Supabase Schema, RLS, Storage, and Verification Script

**Files:**
- Create: `supabase/migrations/20260506000000_player_collaboration.sql`
- Create: `docs/supabase-player-collaboration-rls-verification.md`

- [ ] **Step 1: Create the migration directory**

Run:

```bash
mkdir supabase
mkdir supabase/migrations
```

If either directory already exists, keep it and continue.

- [ ] **Step 2: Create the migration SQL**

Create `supabase/migrations/20260506000000_player_collaboration.sql` with this structure:

```sql
create schema if not exists private;

create extension if not exists pgcrypto;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  created_by uuid not null references auth.users(id),
  title text,
  status text not null default 'active',
  expires_at timestamptz not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_status_check check (status in ('active', 'expired', 'archived')),
  constraint rooms_code_format_check check (room_code ~ '^[A-Z0-9]{6}$')
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  nickname text not null,
  avatar_asset_id uuid,
  identity_id text,
  current_stage text not null default 'entry',
  is_creator boolean not null default false,
  last_active_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_members_unique_user unique (room_id, user_id),
  constraint room_members_nickname_length check (char_length(btrim(nickname)) between 1 and 24)
);

create table public.member_progress (
  id uuid primary key default gen_random_uuid(),
  room_member_id uuid not null references public.room_members(id) on delete cascade,
  journey_stage text not null default 'entry',
  active_view text,
  selected_node_id text,
  map_refreshed boolean not null default false,
  node_states jsonb not null default '{}'::jsonb,
  achievement_ids text[] not null default '{}',
  postcard_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint member_progress_unique_member unique (room_member_id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_member_id uuid not null references public.room_members(id) on delete cascade,
  kind text not null,
  bucket text not null,
  object_path text not null unique,
  mime_type text,
  size_bytes integer,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  constraint media_assets_kind_check check (kind in ('avatar', 'node-photo', 'postcard-poster')),
  constraint media_assets_bucket_check check (bucket = 'xiang-river-media'),
  constraint media_assets_size_check check (size_bytes is null or size_bytes > 0)
);

alter table public.room_members
  add constraint room_members_avatar_asset_id_fkey
  foreign key (avatar_asset_id) references public.media_assets(id);

create table public.node_task_records (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_member_id uuid not null references public.room_members(id) on delete cascade,
  node_id text not null,
  target_id text,
  action text not null,
  media_asset_id uuid references public.media_assets(id),
  captured_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint node_task_records_action_check check (action in ('entered', 'captured', 'completed', 'skipped')),
  constraint node_task_records_count_check check (captured_count >= 0)
);

create table public.game_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_member_id uuid not null references public.room_members(id) on delete cascade,
  game_id text not null,
  stage_id text not null,
  score integer not null default 0,
  passed boolean not null default false,
  duration_ms integer not null default 0,
  completed_objectives text[] not null default '{}',
  next_stage_unlocked text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint game_results_game_id_check check (game_id in ('river-sound', 'island-light', 'memory-resonance')),
  constraint game_results_score_check check (score >= 0),
  constraint game_results_duration_check check (duration_ms >= 0)
);

create table public.postcard_rewards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_member_id uuid not null references public.room_members(id) on delete cascade,
  node_id text not null,
  postcard_id text not null,
  title text not null,
  caption text,
  image_tone text,
  poster_asset_id uuid references public.media_assets(id),
  earned_at timestamptz not null default now(),
  constraint postcard_rewards_unique_member_card unique (room_member_id, postcard_id)
);

create table public.achievement_unlocks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_member_id uuid not null references public.room_members(id) on delete cascade,
  achievement_id text not null,
  source_event text,
  unlocked_at timestamptz not null default now(),
  constraint achievement_unlocks_unique_member_achievement unique (room_member_id, achievement_id)
);

create table public.room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_member_id uuid references public.room_members(id) on delete set null,
  event_type text not null,
  node_id text,
  game_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index rooms_room_code_idx on public.rooms (room_code);
create index rooms_active_code_idx on public.rooms (room_code, expires_at) where status = 'active';
create index room_members_room_idx on public.room_members (room_id);
create index room_members_user_idx on public.room_members (user_id);
create index member_progress_member_idx on public.member_progress (room_member_id);
create index node_task_records_room_idx on public.node_task_records (room_id, created_at desc);
create index game_results_room_score_idx on public.game_results (room_id, score desc);
create index postcard_rewards_room_idx on public.postcard_rewards (room_id);
create index achievement_unlocks_room_idx on public.achievement_unlocks (room_id);
create index media_assets_member_idx on public.media_assets (room_member_id);
create index room_events_room_created_idx on public.room_events (room_id, created_at desc);

create or replace function private.is_room_member(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = target_room_id
      and user_id = auth.uid()
  );
$$;

create or replace function private.is_room_creator(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.rooms
    where id = target_room_id
      and created_by = auth.uid()
  );
$$;

create or replace function private.is_member_owner(target_member_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.room_members
    where id = target_member_id
      and user_id = auth.uid()
  );
$$;

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_room_member(uuid) to authenticated;
grant execute on function private.is_room_creator(uuid) to authenticated;
grant execute on function private.is_member_owner(uuid) to authenticated;
grant select, insert, update on public.rooms to authenticated;
grant select, insert, update on public.room_members to authenticated;
grant select, insert, update on public.member_progress to authenticated;
grant select, insert on public.node_task_records to authenticated;
grant select, insert on public.game_results to authenticated;
grant select, insert on public.postcard_rewards to authenticated;
grant select, insert on public.achievement_unlocks to authenticated;
grant select, insert on public.media_assets to authenticated;
grant select, insert on public.room_events to authenticated;

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.member_progress enable row level security;
alter table public.node_task_records enable row level security;
alter table public.game_results enable row level security;
alter table public.postcard_rewards enable row level security;
alter table public.achievement_unlocks enable row level security;
alter table public.media_assets enable row level security;
alter table public.room_events enable row level security;

create policy "rooms insert own room"
on public.rooms for insert to authenticated
with check (created_by = auth.uid());

create policy "rooms select joined room"
on public.rooms for select to authenticated
using (created_by = auth.uid() or private.is_room_member(id));

create policy "rooms select active by code"
on public.rooms for select to authenticated
using (status = 'active' and expires_at > now());

create policy "rooms creator update"
on public.rooms for update to authenticated
using (private.is_room_creator(id))
with check (private.is_room_creator(id));

create policy "room_members join active room"
on public.room_members for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.rooms
    where rooms.id = room_members.room_id
      and rooms.status = 'active'
      and rooms.expires_at > now()
  )
);

create policy "room_members select same room"
on public.room_members for select to authenticated
using (private.is_room_member(room_id));

create policy "room_members update own member"
on public.room_members for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "member_progress insert own"
on public.member_progress for insert to authenticated
with check (private.is_member_owner(room_member_id));

create policy "member_progress select same room"
on public.member_progress for select to authenticated
using (
  exists (
    select 1
    from public.room_members target
    where target.id = member_progress.room_member_id
      and private.is_room_member(target.room_id)
  )
);

create policy "member_progress update own"
on public.member_progress for update to authenticated
using (private.is_member_owner(room_member_id))
with check (private.is_member_owner(room_member_id));

create policy "append records own member"
on public.node_task_records for insert to authenticated
with check (private.is_member_owner(room_member_id));

create policy "read node records same room"
on public.node_task_records for select to authenticated
using (private.is_room_member(room_id));

create policy "append game results own member"
on public.game_results for insert to authenticated
with check (private.is_member_owner(room_member_id));

create policy "read game results same room"
on public.game_results for select to authenticated
using (private.is_room_member(room_id));

create policy "append postcards own member"
on public.postcard_rewards for insert to authenticated
with check (private.is_member_owner(room_member_id));

create policy "read postcards same room"
on public.postcard_rewards for select to authenticated
using (private.is_room_member(room_id));

create policy "append achievements own member"
on public.achievement_unlocks for insert to authenticated
with check (private.is_member_owner(room_member_id));

create policy "read achievements same room"
on public.achievement_unlocks for select to authenticated
using (private.is_room_member(room_id));

create policy "append media own member"
on public.media_assets for insert to authenticated
with check (private.is_member_owner(room_member_id));

create policy "read media same room"
on public.media_assets for select to authenticated
using (private.is_room_member(room_id));

create policy "append events own member"
on public.room_events for insert to authenticated
with check (room_member_id is null or private.is_member_owner(room_member_id));

create policy "read events same room"
on public.room_events for select to authenticated
using (private.is_room_member(room_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'xiang-river-media',
  'xiang-river-media',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "media objects insert own member path"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'xiang-river-media'
  and name ~ '^rooms/[0-9a-f-]{36}/members/[0-9a-f-]{36}/'
  and exists (
    select 1
    from public.room_members
    where room_members.room_id = split_part(name, '/', 2)::uuid
      and room_members.id = split_part(name, '/', 4)::uuid
      and room_members.user_id = auth.uid()
  )
);

create policy "media objects read same room"
on storage.objects for select to authenticated
using (
  bucket_id = 'xiang-river-media'
  and name ~ '^rooms/[0-9a-f-]{36}/members/[0-9a-f-]{36}/'
  and exists (
    select 1
    from public.room_members viewer
    join public.room_members owner on owner.room_id = viewer.room_id
    where viewer.user_id = auth.uid()
      and owner.id = split_part(name, '/', 4)::uuid
  )
);

alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.member_progress;
alter publication supabase_realtime add table public.node_task_records;
alter publication supabase_realtime add table public.game_results;
alter publication supabase_realtime add table public.postcard_rewards;
alter publication supabase_realtime add table public.achievement_unlocks;
alter publication supabase_realtime add table public.room_events;
```

- [ ] **Step 3: Create RLS verification notes**

Create `docs/supabase-player-collaboration-rls-verification.md`:

```markdown
# Supabase Player Collaboration RLS Verification

Run these checks after applying `supabase/migrations/20260506000000_player_collaboration.sql`.

## Required dashboard checks

- Auth anonymous sign-ins are enabled.
- Bucket `xiang-river-media` exists and is private.
- Tables in public schema all show RLS enabled.
- Realtime is enabled for the planned collaboration tables.

## Manual user checks

Use two browser sessions with two anonymous users.

1. User A creates a room.
2. User B cannot read User A's member-owned rows before joining.
3. User B joins with the room code.
4. User B can read room members, progress summaries, and room events.
5. User B cannot update User A's `member_progress`.
6. User B cannot upload to User A's Storage prefix.
7. User A can upload under `rooms/{room_id}/members/{member_id}/...`.

Expected result: all access is scoped by room membership and member ownership.
```

- [ ] **Step 4: Apply the migration in Supabase**

Use one approved route:

```bash
codex
```

Then ask the Codex session with Supabase MCP access:

```text
Apply the SQL in supabase/migrations/20260506000000_player_collaboration.sql to the configured Supabase project, then run a simple verification query for the created public tables and RLS status.
```

Alternative route: paste the SQL into the Supabase SQL Editor for the intended project.

Expected: all tables, policies, bucket, and publication entries are created.

- [ ] **Step 5: Run verification queries**

Run in Supabase SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'rooms',
    'room_members',
    'member_progress',
    'node_task_records',
    'game_results',
    'postcard_rewards',
    'achievement_unlocks',
    'media_assets',
    'room_events'
  )
order by tablename;
```

Expected: every row has `rowsecurity = true`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260506000000_player_collaboration.sql docs/supabase-player-collaboration-rls-verification.md
git commit -m "feat: 添加游客协作数据表和权限策略"
```

---

### Task 3: Add Collaboration Domain Types and Room Code Rules

**Files:**
- Create: `src/features/collaboration/types.ts`
- Create: `src/features/collaboration/roomCode.ts`
- Create: `src/features/collaboration/roomCode.test.ts`

- [ ] **Step 1: Write failing room code tests**

Create `src/features/collaboration/roomCode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRoomCode, normalizeRoomCode, isRoomCode } from './roomCode';

describe('roomCode', () => {
  it('creates a six-character uppercase room code', () => {
    const code = createRoomCode(() => 0.123456);

    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('normalizes user input', () => {
    expect(normalizeRoomCode(' ab-12 c ')).toBe('AB12C');
  });

  it('validates room code shape', () => {
    expect(isRoomCode('A1B2C3')).toBe(true);
    expect(isRoomCode('abc')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
npm test -- src/features/collaboration/roomCode.test.ts
```

Expected: fail because `roomCode.ts` does not exist.

- [ ] **Step 3: Add collaboration types**

Create `src/features/collaboration/types.ts`:

```ts
import type { PlayerAchievementId, PlayerIdentityId } from '../player/types';

export type RoomStatus = 'active' | 'expired' | 'archived';
export type MediaAssetKind = 'avatar' | 'node-photo' | 'postcard-poster';
export type NodeTaskRecordAction = 'entered' | 'captured' | 'completed' | 'skipped';

export type CollaborationRoom = {
  id: string;
  roomCode: string;
  title: string | null;
  status: RoomStatus;
  expiresAt: string;
};

export type CollaborationMember = {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  identityId: PlayerIdentityId | null;
  currentStage: string;
  avatarAssetId: string | null;
  isCreator: boolean;
  lastActiveAt: string;
};

export type CollaborationProgress = {
  roomMemberId: string;
  journeyStage: string;
  activeView: string | null;
  selectedNodeId: string | null;
  mapRefreshed: boolean;
  nodeStates: Record<string, unknown>;
  achievementIds: PlayerAchievementId[];
  postcardIds: string[];
};

export type CollaborationMediaAsset = {
  id: string;
  roomId: string;
  roomMemberId: string;
  kind: MediaAssetKind;
  bucket: 'xiang-river-media';
  objectPath: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type CollaborationRoomState = {
  room: CollaborationRoom;
  currentMember: CollaborationMember;
  members: CollaborationMember[];
  progressByMemberId: Record<string, CollaborationProgress>;
};
```

- [ ] **Step 4: Implement room code helpers**

Create `src/features/collaboration/roomCode.ts`:

```ts
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

export function normalizeRoomCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}

export function isRoomCode(input: string) {
  return /^[A-Z0-9]{6}$/.test(input);
}

export function createRoomCode(random = Math.random) {
  let code = '';

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const nextIndex = Math.floor(random() * ROOM_CODE_ALPHABET.length) % ROOM_CODE_ALPHABET.length;
    code += ROOM_CODE_ALPHABET[nextIndex];
  }

  return code;
}
```

- [ ] **Step 5: Run the focused test and verify green**

Run:

```bash
npm test -- src/features/collaboration/roomCode.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/collaboration/types.ts src/features/collaboration/roomCode.ts src/features/collaboration/roomCode.test.ts
git commit -m "feat: 添加协作房间类型和房间码规则"
```

---

### Task 4: Add Anonymous Session Bootstrap

**Files:**
- Create: `src/features/supabase/session.ts`
- Create: `src/features/supabase/session.test.ts`

- [ ] **Step 1: Write failing session tests**

Create `src/features/supabase/session.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ensureAnonymousSession } from './session';

describe('ensureAnonymousSession', () => {
  it('returns an existing session without signing in again', async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null }),
        signInAnonymously: vi.fn(),
      },
    };

    const result = await ensureAnonymousSession(client as never);

    expect(result).toEqual({ status: 'ready', userId: 'user-1' });
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously when no session exists', async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: 'anon-1' } }, error: null }),
      },
    };

    const result = await ensureAnonymousSession(client as never);

    expect(result).toEqual({ status: 'ready', userId: 'anon-1' });
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
npm test -- src/features/supabase/session.test.ts
```

Expected: fail because `session.ts` does not exist.

- [ ] **Step 3: Implement anonymous session helper**

Create `src/features/supabase/session.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type SupabaseSessionState =
  | { status: 'ready'; userId: string }
  | { status: 'unavailable'; reason: string };

export async function ensureAnonymousSession(client: SupabaseClient): Promise<SupabaseSessionState> {
  const current = await client.auth.getSession();

  if (current.error) {
    return { status: 'unavailable', reason: current.error.message };
  }

  const existingUserId = current.data.session?.user.id;

  if (existingUserId) {
    return { status: 'ready', userId: existingUserId };
  }

  const created = await client.auth.signInAnonymously();

  if (created.error || !created.data.user?.id) {
    return { status: 'unavailable', reason: created.error?.message ?? 'Anonymous sign-in did not return a user.' };
  }

  return { status: 'ready', userId: created.data.user.id };
}
```

- [ ] **Step 4: Run the focused test and verify green**

Run:

```bash
npm test -- src/features/supabase/session.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/supabase/session.ts src/features/supabase/session.test.ts
git commit -m "feat: 添加 Supabase 匿名会话初始化"
```

---

### Task 5: Add Collaboration API Wrappers

**Files:**
- Create: `src/features/collaboration/collaborationApi.ts`
- Create: `src/features/collaboration/collaborationApi.test.ts`

- [ ] **Step 1: Write failing API wrapper tests**

Create `src/features/collaboration/collaborationApi.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createCollaborationApi } from './collaborationApi';

describe('collaborationApi', () => {
  it('creates a room and member with normalized payloads', async () => {
    const insert = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 'room-1', room_code: 'ABC123', status: 'active', expires_at: '2026-05-07T00:00:00Z', title: null }, error: null })
      .mockResolvedValueOnce({ data: { id: 'member-1', room_id: 'room-1', user_id: 'user-1', nickname: '旅人', identity_id: null, current_stage: 'entry', avatar_asset_id: null, is_creator: true, last_active_at: '2026-05-06T00:00:00Z' }, error: null });
    const from = vi.fn(() => ({ insert, select, single }));

    const api = createCollaborationApi({ from } as never);
    const result = await api.createRoom({ userId: 'user-1', nickname: ' 旅人 ', roomCode: 'ABC123' });

    expect(result.status).toBe('ready');
    expect(from).toHaveBeenCalledWith('rooms');
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
npm test -- src/features/collaboration/collaborationApi.test.ts
```

Expected: fail because `collaborationApi.ts` does not exist.

- [ ] **Step 3: Implement minimal API methods**

Create `src/features/collaboration/collaborationApi.ts` with typed methods:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollaborationMember, CollaborationRoom } from './types';

type CreateRoomInput = {
  userId: string;
  nickname: string;
  roomCode: string;
};

type ApiResult<T> = { status: 'ready'; data: T } | { status: 'error'; message: string };

function mapRoom(row: Record<string, unknown>): CollaborationRoom {
  return {
    id: String(row.id),
    roomCode: String(row.room_code),
    title: typeof row.title === 'string' ? row.title : null,
    status: row.status as CollaborationRoom['status'],
    expiresAt: String(row.expires_at),
  };
}

function mapMember(row: Record<string, unknown>): CollaborationMember {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    userId: String(row.user_id),
    nickname: String(row.nickname),
    identityId: typeof row.identity_id === 'string' ? (row.identity_id as CollaborationMember['identityId']) : null,
    currentStage: String(row.current_stage),
    avatarAssetId: typeof row.avatar_asset_id === 'string' ? row.avatar_asset_id : null,
    isCreator: Boolean(row.is_creator),
    lastActiveAt: String(row.last_active_at),
  };
}

export function createCollaborationApi(client: SupabaseClient) {
  return {
    async createRoom(input: CreateRoomInput): Promise<ApiResult<{ room: CollaborationRoom; member: CollaborationMember }>> {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const roomResult = await client
        .from('rooms')
        .insert({
          room_code: input.roomCode,
          created_by: input.userId,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (roomResult.error || !roomResult.data) {
        return { status: 'error', message: roomResult.error?.message ?? 'Room was not created.' };
      }

      const memberResult = await client
        .from('room_members')
        .insert({
          room_id: roomResult.data.id,
          user_id: input.userId,
          nickname: input.nickname.trim(),
          is_creator: true,
        })
        .select()
        .single();

      if (memberResult.error || !memberResult.data) {
        return { status: 'error', message: memberResult.error?.message ?? 'Room member was not created.' };
      }

      return {
        status: 'ready',
        data: {
          room: mapRoom(roomResult.data),
          member: mapMember(memberResult.data),
        },
      };
    },
  };
}
```

- [ ] **Step 4: Add remaining API methods by the same tested pattern**

Extend tests first, then implement:

- `joinRoom({ userId, nickname, roomCode })`
- `ensureMemberProgress(roomMemberId)`
- `updateMemberProgress(progress)`
- `insertNodeTaskRecord(record)`
- `insertGameResult(result)`
- `insertPostcardReward(reward)`
- `insertAchievementUnlock(unlock)`
- `insertRoomEvent(event)`
- `listRoomState(roomId)`

Expected behavior:

- Each method returns `ApiResult<T>`.
- Each method maps snake_case Supabase rows to camelCase frontend types.
- Each method trims nickname and normalizes room code before writing or querying.

- [ ] **Step 5: Run the focused test and verify green**

Run:

```bash
npm test -- src/features/collaboration/collaborationApi.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/collaboration/collaborationApi.ts src/features/collaboration/collaborationApi.test.ts
git commit -m "feat: 添加游客协作数据访问封装"
```

---

### Task 6: Add Local Fallback and Cloud Snapshot Mapping

**Files:**
- Create: `src/features/collaboration/localFallback.ts`
- Create: `src/features/collaboration/localFallback.test.ts`
- Modify: `src/features/player/types.ts`
- Modify: `src/features/player/playerState.ts`
- Modify: `src/features/player/playerState.test.ts`

- [ ] **Step 1: Write failing local fallback tests**

Create `src/features/collaboration/localFallback.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultPlayerState } from '../player/playerState';
import { buildProgressSnapshot, mergeCloudProgressIntoPlayer } from './localFallback';

describe('localFallback', () => {
  it('builds a compact cloud snapshot from local player state', () => {
    const snapshot = buildProgressSnapshot({
      player: {
        ...createDefaultPlayerState(),
        achievementIds: ['first-node'],
        postcardIds: ['shore-postcard'],
      },
      journeyStage: 'completion',
      activeView: 'journey',
      selectedNodeId: 'shore-gate',
      nodeStates: {
        'shore-gate': { status: 'completed', capturedTargets: ['老码头', '水纹', '树影'] },
      },
    });

    expect(snapshot).toMatchObject({
      journeyStage: 'completion',
      activeView: 'journey',
      selectedNodeId: 'shore-gate',
      achievementIds: ['first-node'],
      postcardIds: ['shore-postcard'],
    });
  });

  it('merges cloud progress without losing local nickname or avatar', () => {
    const local = { ...createDefaultPlayerState(), nickname: '本地旅人', avatarDataUrl: 'data:image/png;base64,avatar' };
    const merged = mergeCloudProgressIntoPlayer(local, {
      achievementIds: ['first-postcard'],
      postcardIds: ['shore-postcard'],
      journeyStage: 'completion',
      activeView: 'journey',
      selectedNodeId: null,
      mapRefreshed: true,
      nodeStates: {},
      roomMemberId: 'member-1',
    });

    expect(merged.nickname).toBe('本地旅人');
    expect(merged.avatarDataUrl).toBe('data:image/png;base64,avatar');
    expect(merged.postcardIds).toEqual(['shore-postcard']);
  });
});
```

- [ ] **Step 2: Run focused tests and verify red**

Run:

```bash
npm test -- src/features/collaboration/localFallback.test.ts
```

Expected: fail because `localFallback.ts` does not exist.

- [ ] **Step 3: Extend local player types only if needed**

If cloud identifiers are useful for restore, add optional fields to `PlayerState` in `src/features/player/types.ts`:

```ts
cloudRoomId?: string | null;
cloudRoomMemberId?: string | null;
cloudSyncedAt?: string | null;
```

Update `createDefaultPlayerState()` and `deserializePlayerState()` so these optional fields default to `null`.

- [ ] **Step 4: Implement fallback mappers**

Create `src/features/collaboration/localFallback.ts`:

```ts
import type { PlayerState } from '../player/types';
import type { CollaborationProgress } from './types';

type BuildProgressSnapshotInput = {
  player: PlayerState;
  journeyStage: string;
  activeView: string | null;
  selectedNodeId: string | null;
  nodeStates: Record<string, unknown>;
};

export function buildProgressSnapshot(input: BuildProgressSnapshotInput): Omit<CollaborationProgress, 'roomMemberId'> {
  return {
    journeyStage: input.journeyStage,
    activeView: input.activeView,
    selectedNodeId: input.selectedNodeId,
    mapRefreshed: input.player.achievementIds.includes('map-awakened'),
    nodeStates: input.nodeStates,
    achievementIds: input.player.achievementIds,
    postcardIds: input.player.postcardIds,
  };
}

export function mergeCloudProgressIntoPlayer(player: PlayerState, progress: CollaborationProgress): PlayerState {
  return {
    ...player,
    achievementIds: Array.from(new Set([...player.achievementIds, ...progress.achievementIds])),
    postcardIds: Array.from(new Set([...player.postcardIds, ...progress.postcardIds])),
    cloudRoomMemberId: progress.roomMemberId,
    cloudSyncedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 5: Run focused tests and player tests**

Run:

```bash
npm test -- src/features/collaboration/localFallback.test.ts src/features/player/playerState.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/collaboration/localFallback.ts src/features/collaboration/localFallback.test.ts src/features/player/types.ts src/features/player/playerState.ts src/features/player/playerState.test.ts
git commit -m "feat: 添加云端进度与本地兜底映射"
```

---

### Task 7: Add Collaboration Room Hook With Realtime and Polling Fallback

**Files:**
- Create: `src/features/collaboration/useCollaborationRoom.ts`
- Create: `src/features/collaboration/useCollaborationRoom.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Create `src/features/collaboration/useCollaborationRoom.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCollaborationRoom } from './useCollaborationRoom';

describe('useCollaborationRoom', () => {
  it('loads room state and exposes refresh state', async () => {
    const api = {
      listRoomState: vi.fn().mockResolvedValue({
        status: 'ready',
        data: {
          room: { id: 'room-1', roomCode: 'ABC123', title: null, status: 'active', expiresAt: '2026-05-07T00:00:00Z' },
          currentMember: { id: 'member-1', roomId: 'room-1', userId: 'user-1', nickname: '旅人', identityId: null, currentStage: 'entry', avatarAssetId: null, isCreator: true, lastActiveAt: '2026-05-06T00:00:00Z' },
          members: [],
          progressByMemberId: {},
        },
      }),
    };
    const client = {
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      })),
      removeChannel: vi.fn(),
    };

    const { result } = renderHook(() => useCollaborationRoom({ roomId: 'room-1', api: api as never, client: client as never }));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(api.listRoomState).toHaveBeenCalledWith('room-1');
  });
});
```

- [ ] **Step 2: Run focused test and verify red**

Run:

```bash
npm test -- src/features/collaboration/useCollaborationRoom.test.tsx
```

Expected: fail because `useCollaborationRoom.ts` does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/features/collaboration/useCollaborationRoom.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollaborationRoomState } from './types';

type CollaborationApiLike = {
  listRoomState(roomId: string): Promise<{ status: 'ready'; data: CollaborationRoomState } | { status: 'error'; message: string }>;
};

type UseCollaborationRoomInput = {
  roomId: string | null;
  api: CollaborationApiLike | null;
  client: SupabaseClient | null;
  pollingMs?: number;
};

export type UseCollaborationRoomState =
  | { status: 'idle'; state: null; refresh: () => Promise<void> }
  | { status: 'loading'; state: null; refresh: () => Promise<void> }
  | { status: 'ready'; state: CollaborationRoomState; refresh: () => Promise<void> }
  | { status: 'error'; state: null; message: string; refresh: () => Promise<void> };

export function useCollaborationRoom(input: UseCollaborationRoomInput): UseCollaborationRoomState {
  const [state, setState] = useState<UseCollaborationRoomState>({ status: 'idle', state: null, refresh: async () => undefined });

  const refresh = useMemo(
    () => async () => {
      if (!input.roomId || !input.api) {
        setState((current) => ({ ...current, status: 'idle', state: null }));
        return;
      }

      setState((current) => ({ ...current, status: current.status === 'ready' ? 'ready' : 'loading' }));
      const result = await input.api.listRoomState(input.roomId);

      if (result.status === 'ready') {
        setState({ status: 'ready', state: result.data, refresh });
      } else {
        setState({ status: 'error', state: null, message: result.message, refresh });
      }
    },
    [input.api, input.roomId]
  );

  useEffect(() => {
    setState((current) => ({ ...current, refresh }));
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!input.roomId || !input.client) {
      return;
    }

    const channel = input.client
      .channel(`xiang-room-${input.roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_events', filter: `room_id=eq.${input.roomId}` }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void input.client?.removeChannel(channel);
    };
  }, [input.client, input.roomId, refresh]);

  useEffect(() => {
    if (!input.roomId || !input.api) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, input.pollingMs ?? 10_000);

    return () => window.clearInterval(interval);
  }, [input.api, input.pollingMs, input.roomId, refresh]);

  return state;
}
```

- [ ] **Step 4: Run focused test and verify green**

Run:

```bash
npm test -- src/features/collaboration/useCollaborationRoom.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/collaboration/useCollaborationRoom.ts src/features/collaboration/useCollaborationRoom.test.tsx
git commit -m "feat: 添加协作房间同步 Hook"
```

---

### Task 8: Add Media Upload Helpers

**Files:**
- Create: `src/features/media/mediaUpload.ts`
- Create: `src/features/media/mediaUpload.test.ts`

- [ ] **Step 1: Write failing media upload tests**

Create `src/features/media/mediaUpload.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMediaObjectPath, getMediaLimitBytes } from './mediaUpload';

describe('mediaUpload', () => {
  it('builds a room/member scoped object path', () => {
    expect(
      buildMediaObjectPath({
        roomId: '11111111-1111-1111-1111-111111111111',
        roomMemberId: '22222222-2222-2222-2222-222222222222',
        kind: 'node-photo',
        assetId: '33333333-3333-3333-3333-333333333333',
        nodeId: 'shore-gate',
        targetId: 'water',
        extension: 'webp',
      })
    ).toBe(
      'rooms/11111111-1111-1111-1111-111111111111/members/22222222-2222-2222-2222-222222222222/node-photos/shore-gate/water-33333333-3333-3333-3333-333333333333.webp'
    );
  });

  it('uses stricter avatar size limits', () => {
    expect(getMediaLimitBytes('avatar')).toBe(2 * 1024 * 1024);
    expect(getMediaLimitBytes('node-photo')).toBe(8 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Run focused test and verify red**

Run:

```bash
npm test -- src/features/media/mediaUpload.test.ts
```

Expected: fail because `mediaUpload.ts` does not exist.

- [ ] **Step 3: Implement media helpers**

Create `src/features/media/mediaUpload.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MediaAssetKind } from '../collaboration/types';

type BuildMediaObjectPathInput = {
  roomId: string;
  roomMemberId: string;
  kind: MediaAssetKind;
  assetId: string;
  nodeId?: string;
  targetId?: string;
  postcardId?: string;
  extension: string;
};

export const MEDIA_BUCKET = 'xiang-river-media';

export function getMediaLimitBytes(kind: MediaAssetKind) {
  return kind === 'avatar' ? 2 * 1024 * 1024 : 8 * 1024 * 1024;
}

export function buildMediaObjectPath(input: BuildMediaObjectPathInput) {
  const safeExtension = input.extension.replace(/^\./, '').toLowerCase();
  const base = `rooms/${input.roomId}/members/${input.roomMemberId}`;

  if (input.kind === 'avatar') {
    return `${base}/avatar/${input.assetId}.${safeExtension}`;
  }

  if (input.kind === 'node-photo') {
    return `${base}/node-photos/${input.nodeId}/${input.targetId}-${input.assetId}.${safeExtension}`;
  }

  return `${base}/posters/${input.postcardId}-${input.assetId}.${safeExtension}`;
}

export async function uploadMediaObject(
  client: SupabaseClient,
  objectPath: string,
  file: File,
  cacheControl = '3600'
) {
  return client.storage.from(MEDIA_BUCKET).upload(objectPath, file, {
    cacheControl,
    upsert: false,
  });
}
```

- [ ] **Step 4: Run focused test and verify green**

Run:

```bash
npm test -- src/features/media/mediaUpload.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/media/mediaUpload.ts src/features/media/mediaUpload.test.ts
git commit -m "feat: 添加协作图片上传路径规则"
```

---

### Task 9: Wire Room Entry Into the App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles/tokens.scss`

- [ ] **Step 1: Write failing App tests for room entry**

Modify `src/App.test.tsx` with tests that cover:

- The app still renders when Supabase env vars are absent.
- The user can open a room panel from the main experience.
- The user can enter a nickname and create a room when a mocked Supabase client is configured.
- The user can enter a nickname and room code to join.
- The local-only path remains visible when Supabase is unavailable.

Use accessible labels:

```ts
expect(screen.getByRole('button', { name: /创建协作房间/ })).toBeInTheDocument();
expect(screen.getByLabelText(/游客昵称/)).toBeInTheDocument();
expect(screen.getByLabelText(/房间码/)).toBeInTheDocument();
```

- [ ] **Step 2: Run App tests and verify red**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: fail because room entry UI is not wired.

- [ ] **Step 3: Add collaboration state to `App.tsx`**

Add local state near existing player state:

```ts
const [collaborationNickname, setCollaborationNickname] = useState(player.nickname);
const [collaborationRoomCode, setCollaborationRoomCode] = useState('');
const [collaborationMessage, setCollaborationMessage] = useState<string | null>(null);
const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
```

Initialize:

- Supabase client with `getSupabaseClient()`.
- anonymous session with `ensureAnonymousSession()`.
- API wrapper with `createCollaborationApi(client)`.

Keep the cloud path optional:

- If Supabase env is missing, show a clear local-demo status.
- Do not block the existing main journey.

- [ ] **Step 4: Add create/join handlers**

Implement handlers in `App.tsx`:

- `handleCreateCollaborationRoom`
- `handleJoinCollaborationRoom`
- `handleLeaveCollaborationRoom`

Expected handler behavior:

- Validate nickname length.
- Generate or normalize room code.
- Call API wrapper.
- Store active room metadata in `localStorage`.
- Set `activeRoomId`.
- Preserve existing `player.nickname`.

- [ ] **Step 5: Add a compact room panel**

Render a compact section in the map/terminal or a dedicated modal-like panel:

- Current room code if joined.
- Nickname field.
- Create room button.
- Join room code field.
- Join room button.
- Local demo fallback status.

Do not create a marketing landing page.

- [ ] **Step 6: Style the panel**

Modify `src/styles/tokens.scss` with mobile-first classes:

- `.collaboration-panel`
- `.collaboration-panel__grid`
- `.collaboration-panel__status`
- `.collaboration-room-code`
- `.collaboration-member-list`

Ensure text does not overflow on narrow mobile widths.

- [ ] **Step 7: Run App tests and verify green**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/styles/tokens.scss
git commit -m "feat: 添加协作房间创建和加入入口"
```

---

### Task 10: Sync Player Progress, Node Tasks, Postcards, Achievements, and Game Results

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/features/collaboration/collaborationApi.ts`
- Modify: `src/features/collaboration/collaborationApi.test.ts`
- Modify: `docs/game-line-apis.md`

- [ ] **Step 1: Write failing sync tests**

Extend tests to cover:

- Completing a photo task inserts a node task record and updates member progress when joined to a room.
- Skipping a node inserts a skipped node task record.
- Earning a postcard inserts a postcard reward and achievement unlock.
- Submitting a game result keeps calling `/api/games/:gameId/result` and then inserts `game_results`.
- If Supabase write fails, the local UI still advances and displays a non-blocking sync warning.

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
npm test -- src/App.test.tsx src/features/collaboration/collaborationApi.test.ts
```

Expected: fail because sync hooks are not connected.

- [ ] **Step 3: Add a single sync helper inside `App.tsx`**

Create small local helpers in `App.tsx` before handlers:

```ts
const syncCollaborationProgress = async (reason: string) => {
  if (!activeRoomId || !collaborationApi || !currentRoomMemberId) {
    return;
  }

  const snapshot = buildProgressSnapshot({
    player,
    journeyStage: screen,
    activeView,
    selectedNodeId: selectedNode?.id ?? null,
    nodeStates: buildNodeStatesSnapshot(),
  });

  const result = await collaborationApi.updateMemberProgress({
    roomMemberId: currentRoomMemberId,
    ...snapshot,
  });

  if (result.status === 'error') {
    setCollaborationMessage(`本地已保存，云端同步稍后重试：${reason}`);
  }
};
```

Keep `buildNodeStatesSnapshot()` narrowly scoped to current node task state and already completed/skipped ids.

- [ ] **Step 4: Wire node task handlers**

Update:

- `handleOpenNode`
- `handleSkipNodeTask`
- `handleCapturePhoto`

Each handler should:

- Preserve existing local state updates.
- Insert append-only Supabase records when active room exists.
- Call `syncCollaborationProgress()`.
- Add a `room_events` row.

- [ ] **Step 5: Wire postcard and achievement persistence**

When `createPostcardReward()` returns a reward:

- Insert `postcard_rewards`.
- Insert `achievement_unlocks` for newly unlocked achievements.
- Keep local `applyAchievementEvent()` as the immediate UI source.

- [ ] **Step 6: Wire game result persistence**

After `fetch(resultEndpoint)` succeeds:

- Insert `game_results`.
- Include `raw_payload`.
- Add a `room_events` row with `game-result-submitted`.
- Do not change the response envelope from `server/gameApi.js`.

- [ ] **Step 7: Document the mirror behavior**

Modify `docs/game-line-apis.md`:

- Add a note that `/api/games/*` remains the handoff contract.
- Add a note that the host app mirrors accepted results into Supabase when a collaboration room is active.

- [ ] **Step 8: Run focused tests and verify green**

Run:

```bash
npm test -- src/App.test.tsx src/features/collaboration/collaborationApi.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/features/collaboration/collaborationApi.ts src/features/collaboration/collaborationApi.test.ts docs/game-line-apis.md
git commit -m "feat: 同步玩家进度和小游戏结果到 Supabase"
```

---

### Task 11: Wire Media Upload Into Avatar, Node Photo, and Poster Flows

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/features/media/mediaUpload.ts`
- Modify: `src/features/media/mediaUpload.test.ts`

- [ ] **Step 1: Write failing media flow tests**

Extend tests to cover:

- Avatar upload still updates local preview.
- In an active room, avatar upload calls `uploadMediaObject()` and inserts `media_assets`.
- Node photo capture accepts a file-backed capture path and inserts a `node-photo` media asset.
- Poster sharing can create a `postcard-poster` media path when a generated file exists.
- Oversized avatar and node photo are rejected before upload.

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
npm test -- src/App.test.tsx src/features/media/mediaUpload.test.ts
```

Expected: fail because media upload is not wired.

- [ ] **Step 3: Extend `mediaUpload.ts` with validation**

Add:

```ts
export function validateMediaFile(kind: MediaAssetKind, file: File) {
  const limit = getMediaLimitBytes(kind);

  if (file.size > limit) {
    return { valid: false, message: `文件不能超过 ${Math.round(limit / 1024 / 1024)}MB` };
  }

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return { valid: false, message: '仅支持 PNG、JPEG 或 WebP 图片' };
  }

  return { valid: true, message: null };
}
```

- [ ] **Step 4: Wire avatar upload**

Update `handleAvatarUpload`:

- Keep `FileReader` local preview behavior.
- If active room exists, upload to Storage under `avatar`.
- Insert `media_assets`.
- Update `room_members.avatar_asset_id`.
- Keep old local avatar if upload fails.

- [ ] **Step 5: Wire node photo metadata**

For first implementation, keep the current photo target button behavior and attach uploaded media only when the UI provides a file input for that target.

Add a scoped file input in the photo task UI:

- Label: `上传当前景物照片`
- Accept: `image/png,image/jpeg,image/webp`
- Store selected file for the target.
- Upload when `handleCapturePhoto(target)` runs.

- [ ] **Step 6: Wire poster upload path**

When a poster file/blob is available from final poster generation:

- Use `postcard-poster` path.
- Insert `media_assets`.
- Link `postcard_rewards.poster_asset_id`.

If poster generation is not available yet, keep the share text behavior and skip upload with a visible local-only message.

- [ ] **Step 7: Run tests and verify green**

Run:

```bash
npm test -- src/App.test.tsx src/features/media/mediaUpload.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/features/media/mediaUpload.ts src/features/media/mediaUpload.test.ts
git commit -m "feat: 接入协作图片上传流程"
```

---

### Task 12: Add Team Progress Surface

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles/tokens.scss`

- [ ] **Step 1: Write failing team surface tests**

Extend `src/App.test.tsx` to cover:

- Room code is displayed after create/join.
- Member list displays teammate nicknames.
- Node completion summary displays completed count.
- Leaderboard displays game score ordering.
- Realtime refresh updates visible team state after a mocked room event.

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: fail because team progress UI is not present.

- [ ] **Step 3: Add derived team summaries**

In `App.tsx`, derive:

- `teamMemberCount`
- `teamCompletedNodeCount`
- `teamPostcardCount`
- `teamLeaderboard`
- `recentRoomEvents`

Use `useCollaborationRoom()` state as source when online, otherwise hide team metrics.

- [ ] **Step 4: Render the team surface**

Add a compact panel near terminal/map views:

- Room code.
- Members.
- Node completion summary.
- Recent room activity.
- Scoreboard.
- Manual refresh button.

Keep it dense and utilitarian for mobile use.

- [ ] **Step 5: Add mobile-safe styling**

Modify `src/styles/tokens.scss`:

- Keep panels scroll-safe.
- Avoid nested cards.
- Ensure room code and nickname text wrap correctly.
- Keep touch targets at least 40px tall.

- [ ] **Step 6: Run tests and verify green**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/styles/tokens.scss
git commit -m "feat: 添加协作团队进度面板"
```

---

### Task 13: Add Documentation, Deployment Notes, and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-06-supabase-player-collaboration-design.md`
- Modify: `xiang-river-obsidian-vault/03-技术实现/30-Supabase游客协作数据系统设计.md`
- Modify: `xiang-river-obsidian-vault/03-技术实现/00-技术实现总览.md` if a new implementation note is synced.

- [ ] **Step 1: Update README**

Add:

- Required Supabase env vars.
- Local fallback behavior.
- Development commands.
- A warning that `SUPABASE_SERVICE_ROLE_KEY` must not be exposed to frontend code.

- [ ] **Step 2: Update design doc status**

Add an implementation status note to the approved design doc:

```markdown
## Implementation Status

The first implementation pass follows `docs/superpowers/plans/2026-05-06-supabase-player-collaboration-implementation.md`.
```

- [ ] **Step 3: Sync Obsidian notes**

Update the Obsidian technical section so the plan is discoverable:

- Add a vault note for this implementation plan.
- Link it from `xiang-river-obsidian-vault/03-技术实现/00-技术实现总览.md`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/features/supabase/client.test.ts src/features/supabase/session.test.ts src/features/collaboration/roomCode.test.ts src/features/collaboration/collaborationApi.test.ts src/features/collaboration/localFallback.test.ts src/features/collaboration/useCollaborationRoom.test.tsx src/features/media/mediaUpload.test.ts src/App.test.tsx
```

Expected: pass.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
npm run build
npm run lint
```

Expected: all commands exit successfully.

- [ ] **Step 6: Manual two-browser verification**

Use two browser profiles:

1. Browser A creates a room as `旅人A`.
2. Browser B joins the room as `旅人B`.
3. Browser A completes one node task.
4. Browser B sees the team progress update.
5. Browser A uploads an avatar.
6. Browser B sees the avatar after refresh or realtime update.
7. Browser B submits a game result.
8. Browser A sees the leaderboard update.
9. Disable network and confirm local demo state still works.

- [ ] **Step 7: Supabase verification**

Run the checks in `docs/supabase-player-collaboration-rls-verification.md`.

Expected:

- Same-room reads work.
- Cross-room reads fail.
- Other-member writes fail.
- Storage uploads outside own prefix fail.

- [ ] **Step 8: Commit**

```bash
git add README.md docs/superpowers/specs/2026-05-06-supabase-player-collaboration-design.md xiang-river-obsidian-vault/03-技术实现/30-Supabase游客协作数据系统设计.md xiang-river-obsidian-vault/03-技术实现/00-技术实现总览.md
git commit -m "docs: 更新 Supabase 协作系统实施说明"
```

---

## Risk Register and Validation

| Risk | Impact | Mitigation | Validation |
| --- | --- | --- | --- |
| RLS policy allows cross-room reads | Privacy leak | Use helper functions and same-room policy tests | Two anonymous users test before and after joining |
| Storage path policy can be bypassed | Media leak or overwrite | Use private bucket, strict path regex, no upsert | Upload outside own prefix must fail |
| Anonymous session unavailable | Online mode blocked | Keep local-only fallback visible | Run app with missing env vars |
| Room code collision | Create room failure | Retry client generation on unique violation | Mock duplicate code response in tests |
| Realtime fails in mobile browser | Team panel stale | Poll every 5 to 10 seconds while room is active | Disable realtime mock and confirm polling refreshes |
| App.tsx grows further | Maintenance risk | Keep domain logic in feature modules and only coordinate in App | Review diff for large unrelated refactors |
| Existing game contract changes accidentally | Collaborator breakage | Keep `/api/games/*` envelope untouched | Existing API tests and App game tests pass |
| `service_role` leaks to frontend | Severe security issue | Only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in frontend | Search code for `SERVICE_ROLE` before commit |

## Final Verification Commands

Run before calling the implementation complete:

```bash
npm test
npm run build
npm run lint
```

Also run Supabase-side verification from:

```text
docs/supabase-player-collaboration-rls-verification.md
```

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-06-supabase-player-collaboration-implementation.md`.

Two execution options:

1. Subagent-Driven (recommended): dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution: execute tasks in this session using executing-plans, batch execution with checkpoints.

