-- Comunidade aberta para todas as professoras + exclusão pela autora.

update public.feature_flags
set release_mode = 'all', updated_at = now()
where key = 'community';

create or replace function public.can_access_community()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'teacher'
    );
$$;

drop policy if exists "community_posts_released_read" on public.community_posts;
drop policy if exists "community_posts_teacher_read_published" on public.community_posts;
create policy "community_posts_teacher_read_published" on public.community_posts
for select using (
  status = 'published'
  and (public.can_access_community() or public.is_admin())
);

drop policy if exists "community_posts_author_read_own" on public.community_posts;
create policy "community_posts_author_read_own" on public.community_posts
for select using (author_id = auth.uid());

drop policy if exists "community_posts_released_insert" on public.community_posts;
drop policy if exists "community_posts_teacher_insert" on public.community_posts;
create policy "community_posts_teacher_insert" on public.community_posts
for insert with check (
  author_id = auth.uid()
  and (public.can_access_community() or public.is_admin())
);

drop policy if exists "community_posts_author_or_admin_update" on public.community_posts;
create policy "community_posts_author_or_admin_update" on public.community_posts
for update using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());

drop policy if exists "community_posts_author_delete" on public.community_posts;
create policy "community_posts_author_delete" on public.community_posts
for delete using (author_id = auth.uid() or public.is_admin());
