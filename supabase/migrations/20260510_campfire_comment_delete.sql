drop policy if exists "campfire comments can be deleted by demo clients" on public.campfire_comments;
create policy "campfire comments can be deleted by demo clients"
  on public.campfire_comments
  for delete
  using (true);

