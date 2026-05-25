-- Community features for Material de Apoio.
-- Adds favorites, ratings, reports and counters without changing existing rows.

alter table public.materials
  add column if not exists views_count integer not null default 0,
  add column if not exists ratings_count integer not null default 0,
  add column if not exists average_rating numeric(3,2) not null default 0,
  add column if not exists reports_count integer not null default 0,
  add column if not exists auto_hidden_at timestamptz;

create table if not exists public.material_favorites (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (material_id, owner_id)
);

create table if not exists public.material_ratings (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, owner_id)
);

create table if not exists public.material_reports (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique (material_id, reporter_id)
);

alter table public.material_favorites enable row level security;
alter table public.material_ratings enable row level security;
alter table public.material_reports enable row level security;

drop policy if exists "material_favorites_owner_all" on public.material_favorites;
create policy "material_favorites_owner_all" on public.material_favorites
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "material_ratings_read_published" on public.material_ratings;
create policy "material_ratings_read_published" on public.material_ratings
for select using (
  public.is_admin()
  or owner_id = auth.uid()
  or exists (
    select 1 from public.materials m
    where m.id = material_ratings.material_id
      and (m.status = 'published' or m.submitted_by = auth.uid() or m.author_id = auth.uid())
  )
);

drop policy if exists "material_ratings_owner_write" on public.material_ratings;
create policy "material_ratings_owner_write" on public.material_ratings
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "material_reports_owner_or_admin_read" on public.material_reports;
create policy "material_reports_owner_or_admin_read" on public.material_reports
for select using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "material_reports_owner_insert" on public.material_reports;
create policy "material_reports_owner_insert" on public.material_reports
for insert with check (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "material_reports_admin_update" on public.material_reports;
create policy "material_reports_admin_update" on public.material_reports
for update using (public.is_admin())
with check (public.is_admin());

drop trigger if exists material_ratings_updated_at on public.material_ratings;
create trigger material_ratings_updated_at before update on public.material_ratings
for each row execute function public.set_updated_at();

create index if not exists material_favorites_owner_created_idx
on public.material_favorites(owner_id, created_at desc);

create index if not exists material_ratings_material_idx
on public.material_ratings(material_id);

create index if not exists material_reports_material_status_idx
on public.material_reports(material_id, status);
