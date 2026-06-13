create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists community_post_likes_user_idx
  on public.community_post_likes(user_id);

create index if not exists community_post_comments_post_created_idx
  on public.community_post_comments(post_id, created_at asc);

create or replace function public.sync_community_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts
    set likes_count = likes_count + 1
    where id = new.post_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.community_posts
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

create or replace function public.sync_community_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts
    set comments_count = comments_count + 1
    where id = new.post_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.community_posts
    set comments_count = greatest(comments_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists community_post_likes_count_sync on public.community_post_likes;
create trigger community_post_likes_count_sync
after insert or delete on public.community_post_likes
for each row execute function public.sync_community_post_likes_count();

drop trigger if exists community_post_comments_count_sync on public.community_post_comments;
create trigger community_post_comments_count_sync
after insert or delete on public.community_post_comments
for each row execute function public.sync_community_post_comments_count();

alter table public.community_post_likes enable row level security;
alter table public.community_post_comments enable row level security;

create or replace function public.can_access_community()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.feature_flags where key = 'community' and release_mode = 'all')
    or exists (
      select 1 from public.feature_user_access
      where feature_key = 'community'
        and user_id = auth.uid()
    )
    or public.is_admin();
$$;

drop policy if exists "community_post_likes_read" on public.community_post_likes;
create policy "community_post_likes_read" on public.community_post_likes
for select using (public.can_access_community());

drop policy if exists "community_post_likes_insert" on public.community_post_likes;
create policy "community_post_likes_insert" on public.community_post_likes
for insert with check (user_id = auth.uid() and public.can_access_community());

drop policy if exists "community_post_likes_delete" on public.community_post_likes;
create policy "community_post_likes_delete" on public.community_post_likes
for delete using (user_id = auth.uid());

drop policy if exists "community_post_comments_read" on public.community_post_comments;
create policy "community_post_comments_read" on public.community_post_comments
for select using (public.can_access_community());

drop policy if exists "community_post_comments_insert" on public.community_post_comments;
create policy "community_post_comments_insert" on public.community_post_comments
for insert with check (author_id = auth.uid() and public.can_access_community());

drop policy if exists "community_post_comments_delete" on public.community_post_comments;
create policy "community_post_comments_delete" on public.community_post_comments
for delete using (author_id = auth.uid() or public.is_admin());
