-- Permite que participantes da comunidade vejam o nome das autoras em postagens publicadas.
drop policy if exists "profiles_community_author_read" on public.profiles;
create policy "profiles_community_author_read" on public.profiles
for select using (
  exists (
    select 1
    from public.community_posts cp
    where cp.author_id = profiles.id
      and cp.status = 'published'
  )
  and (
    exists (select 1 from public.feature_flags where key = 'community' and release_mode = 'all')
    or exists (
      select 1 from public.feature_user_access
      where feature_key = 'community'
        and user_id = auth.uid()
    )
    or public.is_admin()
  )
);
