create schema if not exists private;

create extension if not exists pgcrypto;

create or replace function private.storage_room_id(object_name text)
returns uuid
language sql
immutable
as $$
  select substring(
    object_name
    from '^rooms/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/members/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  )::uuid;
$$;

create or replace function private.storage_member_id(object_name text)
returns uuid
language sql
immutable
as $$
  select substring(
    object_name
    from '^rooms/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/members/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'
  )::uuid;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
  constraint media_assets_size_check check (size_bytes is null or size_bytes > 0),
  constraint media_assets_object_path_check check (
    private.storage_room_id(object_path) is not null
    and private.storage_member_id(object_path) is not null
    and private.storage_room_id(object_path) = room_id
    and private.storage_member_id(object_path) = room_member_id
  )
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

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function private.set_updated_at();

create trigger room_members_set_updated_at
before update on public.room_members
for each row execute function private.set_updated_at();

create trigger member_progress_set_updated_at
before update on public.member_progress
for each row execute function private.set_updated_at();

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

create or replace function private.is_room_member_owner(target_room_id uuid, target_member_id uuid)
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
      and room_id = target_room_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.find_active_room_by_code(search_room_code text)
returns table (
  id uuid,
  room_code text,
  title text,
  status text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select rooms.id, rooms.room_code, rooms.title, rooms.status, rooms.expires_at
  from public.rooms
  where rooms.room_code = upper(btrim(search_room_code))
    and rooms.status = 'active'
    and rooms.expires_at > now()
  limit 1;
$$;

revoke all on function public.find_active_room_by_code(text) from public;
grant execute on function public.find_active_room_by_code(text) to authenticated;

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.storage_room_id(text) to authenticated;
grant execute on function private.storage_member_id(text) to authenticated;
grant execute on function private.is_room_member(uuid) to authenticated;
grant execute on function private.is_room_creator(uuid) to authenticated;
grant execute on function private.is_member_owner(uuid) to authenticated;
grant execute on function private.is_room_member_owner(uuid, uuid) to authenticated;

grant select, insert on public.rooms to authenticated;
grant update (title, status, expires_at, archived_at, updated_at) on public.rooms to authenticated;

grant select, insert on public.room_members to authenticated;
grant update (
  nickname,
  avatar_asset_id,
  identity_id,
  current_stage,
  last_active_at,
  updated_at
) on public.room_members to authenticated;

grant select, insert on public.member_progress to authenticated;
grant update (
  journey_stage,
  active_view,
  selected_node_id,
  map_refreshed,
  node_states,
  achievement_ids,
  postcard_ids,
  updated_at
) on public.member_progress to authenticated;

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

create policy "rooms select joined or created room"
on public.rooms for select to authenticated
using (created_by = auth.uid() or private.is_room_member(id));

create policy "rooms creator update"
on public.rooms for update to authenticated
using (private.is_room_creator(id))
with check (private.is_room_creator(id));

create policy "room_members join active room"
on public.room_members for insert to authenticated
with check (
  user_id = auth.uid()
  and (is_creator = false or private.is_room_creator(room_id))
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
with check (
  user_id = auth.uid()
  and (
    avatar_asset_id is null
    or exists (
      select 1
      from public.media_assets
      where media_assets.id = room_members.avatar_asset_id
        and media_assets.room_member_id = room_members.id
    )
  )
);

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

create policy "append node records own member"
on public.node_task_records for insert to authenticated
with check (
  private.is_room_member_owner(room_id, room_member_id)
  and (
    media_asset_id is null
    or exists (
      select 1
      from public.media_assets
      where media_assets.id = node_task_records.media_asset_id
        and media_assets.room_member_id = node_task_records.room_member_id
    )
  )
);

create policy "read node records same room"
on public.node_task_records for select to authenticated
using (private.is_room_member(room_id));

create policy "append game results own member"
on public.game_results for insert to authenticated
with check (private.is_room_member_owner(room_id, room_member_id));

create policy "read game results same room"
on public.game_results for select to authenticated
using (private.is_room_member(room_id));

create policy "append postcards own member"
on public.postcard_rewards for insert to authenticated
with check (
  private.is_room_member_owner(room_id, room_member_id)
  and (
    poster_asset_id is null
    or exists (
      select 1
      from public.media_assets
      where media_assets.id = postcard_rewards.poster_asset_id
        and media_assets.room_member_id = postcard_rewards.room_member_id
    )
  )
);

create policy "read postcards same room"
on public.postcard_rewards for select to authenticated
using (private.is_room_member(room_id));

create policy "append achievements own member"
on public.achievement_unlocks for insert to authenticated
with check (private.is_room_member_owner(room_id, room_member_id));

create policy "read achievements same room"
on public.achievement_unlocks for select to authenticated
using (private.is_room_member(room_id));

create policy "append media own member"
on public.media_assets for insert to authenticated
with check (
  private.is_room_member_owner(room_id, room_member_id)
  and private.storage_room_id(object_path) = room_id
  and private.storage_member_id(object_path) = room_member_id
);

create policy "read media same room"
on public.media_assets for select to authenticated
using (private.is_room_member(room_id));

create policy "append events own room"
on public.room_events for insert to authenticated
with check (
  (
    room_member_id is null
    and private.is_room_member(room_id)
  )
  or private.is_room_member_owner(room_id, room_member_id)
);

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

grant select, insert on storage.objects to authenticated;

create policy "media objects insert own member path"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'xiang-river-media'
  and private.storage_room_id(name) is not null
  and private.storage_member_id(name) is not null
  and exists (
    select 1
    from public.room_members
    where room_members.room_id = private.storage_room_id(name)
      and room_members.id = private.storage_member_id(name)
      and room_members.user_id = auth.uid()
  )
);

create policy "media objects read same room"
on storage.objects for select to authenticated
using (
  bucket_id = 'xiang-river-media'
  and private.storage_room_id(name) is not null
  and private.storage_member_id(name) is not null
  and exists (
    select 1
    from public.room_members viewer
    join public.room_members owner on owner.room_id = viewer.room_id
    where viewer.user_id = auth.uid()
      and owner.room_id = private.storage_room_id(name)
      and owner.id = private.storage_member_id(name)
  )
);

alter table public.rooms replica identity full;
alter table public.room_members replica identity full;
alter table public.member_progress replica identity full;
alter table public.node_task_records replica identity full;
alter table public.game_results replica identity full;
alter table public.postcard_rewards replica identity full;
alter table public.achievement_unlocks replica identity full;
alter table public.room_events replica identity full;

do $$
declare
  realtime_table text;
  realtime_tables text[] := array[
    'rooms',
    'room_members',
    'member_progress',
    'node_task_records',
    'game_results',
    'postcard_rewards',
    'achievement_unlocks',
    'room_events'
  ];
begin
  foreach realtime_table in array realtime_tables loop
    if exists (
      select 1
      from pg_publication
      where pubname = 'supabase_realtime'
    )
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end $$;
