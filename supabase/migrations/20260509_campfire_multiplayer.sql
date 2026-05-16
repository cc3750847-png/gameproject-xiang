create table if not exists public.campfire_notes (
  id text primary key,
  scene text not null,
  kind text not null check (kind in ('official', 'user')),
  owner_id text,
  title text not null check (char_length(title) <= 80),
  body text not null check (char_length(body) <= 500),
  x double precision not null,
  y double precision not null default 0,
  z double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists public.campfire_comments (
  id text primary key,
  note_id text not null references public.campfire_notes(id) on delete cascade,
  scene text not null,
  author_name text not null check (char_length(author_name) <= 80),
  body text not null check (char_length(body) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists campfire_notes_scene_created_idx
  on public.campfire_notes (scene, created_at);

create index if not exists campfire_comments_scene_created_idx
  on public.campfire_comments (scene, created_at);

create index if not exists campfire_comments_note_created_idx
  on public.campfire_comments (note_id, created_at);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'campfire_notes'
    ) then
      alter publication supabase_realtime add table public.campfire_notes;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'campfire_comments'
    ) then
      alter publication supabase_realtime add table public.campfire_comments;
    end if;
  end if;
end $$;

alter table public.campfire_notes enable row level security;
alter table public.campfire_comments enable row level security;

drop policy if exists "campfire notes are publicly readable" on public.campfire_notes;
create policy "campfire notes are publicly readable"
  on public.campfire_notes
  for select
  using (true);

drop policy if exists "campfire notes can be inserted by demo clients" on public.campfire_notes;
create policy "campfire notes can be inserted by demo clients"
  on public.campfire_notes
  for insert
  with check (kind in ('official', 'user'));

drop policy if exists "user campfire notes can be deleted by demo clients" on public.campfire_notes;
create policy "user campfire notes can be deleted by demo clients"
  on public.campfire_notes
  for delete
  using (kind = 'user');

drop policy if exists "campfire comments are publicly readable" on public.campfire_comments;
create policy "campfire comments are publicly readable"
  on public.campfire_comments
  for select
  using (true);

drop policy if exists "campfire comments can be inserted by demo clients" on public.campfire_comments;
create policy "campfire comments can be inserted by demo clients"
  on public.campfire_comments
  for insert
  with check (true);

insert into public.campfire_notes (
  id,
  scene,
  kind,
  owner_id,
  title,
  body,
  x,
  y,
  z,
  created_at
) values (
  'official-origin-campfire',
  'changsha-juzizhou',
  'official',
  'system',
  '橘子洲迎客篝火',
  '欢迎初登橘子洲头的旅人。这里是湘江与城市相望的起点，愿你沿着洲头、江风与灯火，留下属于这次旅程的第一句话。',
  0,
  0,
  0,
  '2026-05-09T00:00:00+08:00'
) on conflict (id) do update set
  scene = excluded.scene,
  kind = excluded.kind,
  owner_id = excluded.owner_id,
  title = excluded.title,
  body = excluded.body,
  x = excluded.x,
  y = excluded.y,
  z = excluded.z;
