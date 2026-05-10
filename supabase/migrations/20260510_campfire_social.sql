alter table public.campfire_comments
  add column if not exists author_id text;

alter table public.campfire_comments
  add column if not exists parent_comment_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campfire_comments_parent_comment_id_fkey'
  ) then
    alter table public.campfire_comments
      add constraint campfire_comments_parent_comment_id_fkey
      foreign key (parent_comment_id)
      references public.campfire_comments(id)
      on delete cascade;
  end if;
end $$;

update public.campfire_comments
set author_id = author_name
where author_id is null;

create index if not exists campfire_comments_parent_created_idx
  on public.campfire_comments (parent_comment_id, created_at);

create table if not exists public.campfire_note_likes (
  note_id text not null references public.campfire_notes(id) on delete cascade,
  scene text not null,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  primary key (note_id, visitor_id)
);

create index if not exists campfire_note_likes_scene_idx
  on public.campfire_note_likes (scene);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'campfire_note_likes'
    ) then
      alter publication supabase_realtime add table public.campfire_note_likes;
    end if;
  end if;
end $$;

alter table public.campfire_note_likes enable row level security;

drop policy if exists "campfire likes are publicly readable" on public.campfire_note_likes;
create policy "campfire likes are publicly readable"
  on public.campfire_note_likes
  for select
  using (true);

drop policy if exists "campfire likes can be inserted by demo clients" on public.campfire_note_likes;
create policy "campfire likes can be inserted by demo clients"
  on public.campfire_note_likes
  for insert
  with check (true);

drop policy if exists "campfire likes can be deleted by demo clients" on public.campfire_note_likes;
create policy "campfire likes can be deleted by demo clients"
  on public.campfire_note_likes
  for delete
  using (true);

