-- Admin broadcast announcements shown in the professora app

create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('novidade', 'info', 'alerta', 'manutencao')),
  title text not null,
  body text not null check (char_length(body) <= 240),
  audience text not null check (audience in ('todas', 'pagando', 'trial', 'atraso', 'verificadas')),
  cta_label text,
  cta_url text,
  pinned boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.app_announcement_deliveries (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.app_announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index if not exists app_announcement_deliveries_user_idx
  on public.app_announcement_deliveries (user_id, dismissed_at);

create index if not exists app_announcements_created_idx
  on public.app_announcements (created_at desc);

alter table public.app_announcements enable row level security;
alter table public.app_announcement_deliveries enable row level security;

create policy "app_announcements_admin_all" on public.app_announcements
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "app_announcement_deliveries_admin_all" on public.app_announcement_deliveries
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "app_announcement_deliveries_owner_select" on public.app_announcement_deliveries
  for select using (auth.uid() = user_id);

create policy "app_announcement_deliveries_owner_update" on public.app_announcement_deliveries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
