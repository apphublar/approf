-- Approf privacy-first foundation.
-- Run this migration after enabling Supabase Auth.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('super_admin', 'admin', 'teacher');
create type public.subscription_status as enum ('trial', 'active', 'overdue', 'blocked', 'canceled');
create type public.payment_provider as enum ('manual', 'stripe', 'mercado_pago', 'other');
create type public.annotation_category as enum (
  'evolucao',
  'plano',
  'portfolio',
  'projeto',
  'formacao',
  'carta',
  'atipico'
);
create type public.annotation_target_type as enum ('student', 'class', 'school', 'teacher');
create type public.annotation_persistence as enum (
  'relatorio-atual',
  'proximo-relatorio',
  'observacao-continua',
  'planejamento-futuro',
  'observacao-importante',
  'evolucao-positiva'
);
create type public.timeline_event_type as enum (
  'evolucao',
  'atividade',
  'foto',
  'emocao',
  'alimentacao',
  'socializacao',
  'desenvolvimento',
  'marco'
);
create type public.report_status as enum ('draft', 'generating', 'ready', 'failed', 'archived');
create type public.notification_channel as enum ('email', 'telegram', 'system');
create type public.notification_status as enum ('queued', 'sent', 'failed', 'canceled');
create type public.media_visibility as enum ('private', 'guardian_authorized', 'internal_review');
create type public.material_status as enum ('draft', 'published', 'archived');
create type public.feature_release_mode as enum ('off', 'selected', 'all');
create type public.community_post_status as enum ('published', 'hidden', 'removed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'teacher',
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.subscription_status not null default 'trial',
  plan text not null default 'trial_15_days',
  provider public.payment_provider not null default 'manual',
  external_reference text,
  trial_expires_at timestamptz,
  current_period_end timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  city text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  name text not null,
  shift text,
  age_group text,
  school_year integer not null default extract(year from now())::integer,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  full_name text not null,
  birth_date date,
  photo_path text,
  notes_private text,
  support_tags text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_guardian_consents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_name text not null,
  consent_kind text not null,
  granted boolean not null default false,
  evidence_path text,
  expires_at date,
  created_at timestamptz not null default now()
);

create table public.child_media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  storage_bucket text not null default 'child-photos',
  storage_path text not null,
  visibility public.media_visibility not null default 'private',
  caption text,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category public.annotation_category not null,
  body text not null,
  tags text[] not null default '{}',
  persistence public.annotation_persistence[] not null default '{observacao-continua}',
  attachment_path text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.annotation_targets (
  id uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references public.annotations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.annotation_target_type not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

create table public.student_timeline_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  annotation_id uuid references public.annotations(id) on delete set null,
  event_type public.timeline_event_type not null,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  attachment_path text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  status public.report_status not null default 'draft',
  report_type text not null,
  prompt_version text,
  body text,
  exported_pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.material_categories(id) on delete set null,
  title text not null,
  description text,
  file_path text,
  file_name text,
  file_type text,
  file_size_bytes bigint,
  status public.material_status not null default 'draft',
  downloads_count integer not null default 0,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  telegram_chat_id text not null,
  telegram_username text,
  linked_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (user_id),
  unique (telegram_chat_id)
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  channel public.notification_channel not null,
  type text not null,
  status public.notification_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  name text not null,
  release_mode public.feature_release_mode not null default 'off',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feature_user_access (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null references public.feature_flags(key) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (feature_key, user_id)
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  category text not null default 'relato',
  status public.community_post_status not null default 'published',
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin', 'admin')
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();
create trigger schools_updated_at before update on public.schools
for each row execute function public.set_updated_at();
create trigger classes_updated_at before update on public.classes
for each row execute function public.set_updated_at();
create trigger students_updated_at before update on public.students
for each row execute function public.set_updated_at();
create trigger annotations_updated_at before update on public.annotations
for each row execute function public.set_updated_at();
create trigger reports_updated_at before update on public.reports
for each row execute function public.set_updated_at();
create trigger material_categories_updated_at before update on public.material_categories
for each row execute function public.set_updated_at();
create trigger materials_updated_at before update on public.materials
for each row execute function public.set_updated_at();
create trigger feature_flags_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();
create trigger community_posts_updated_at before update on public.community_posts
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_guardian_consents enable row level security;
alter table public.child_media_assets enable row level security;
alter table public.annotations enable row level security;
alter table public.annotation_targets enable row level security;
alter table public.student_timeline_events enable row level security;
alter table public.reports enable row level security;
alter table public.reports_usage enable row level security;
alter table public.material_categories enable row level security;
alter table public.materials enable row level security;
alter table public.telegram_accounts enable row level security;
alter table public.notification_events enable row level security;
alter table public.feature_flags enable row level security;
alter table public.feature_user_access enable row level security;
alter table public.community_posts enable row level security;
alter table public.admin_action_logs enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid() and role = 'teacher');
create policy "profiles_admin_all" on public.profiles
for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "subscriptions_select_own_or_admin" on public.subscriptions
for select using (user_id = auth.uid() or public.is_admin());
create policy "subscriptions_admin_write" on public.subscriptions
for all using (public.is_admin()) with check (public.is_admin());

create policy "schools_owner_all" on public.schools
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "classes_owner_all" on public.classes
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "students_owner_all" on public.students
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "guardian_consents_owner_all" on public.student_guardian_consents
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "child_media_owner_all" on public.child_media_assets
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "annotations_owner_all" on public.annotations
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "annotation_targets_owner_all" on public.annotation_targets
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "student_timeline_events_owner_all" on public.student_timeline_events
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "reports_owner_all" on public.reports
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "reports_usage_owner_select" on public.reports_usage
for select using (owner_id = auth.uid() or public.is_admin());
create policy "reports_usage_admin_write" on public.reports_usage
for all using (public.is_admin()) with check (public.is_admin());

create policy "material_categories_public_read_active" on public.material_categories
for select using (is_active = true or public.is_admin());
create policy "material_categories_admin_write" on public.material_categories
for all using (public.is_admin()) with check (public.is_admin());

create policy "materials_public_read_published" on public.materials
for select using (status = 'published' or public.is_admin());
create policy "materials_admin_write" on public.materials
for all using (public.is_admin()) with check (public.is_admin());

create policy "telegram_accounts_owner_all" on public.telegram_accounts
for all using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "notification_events_owner_select" on public.notification_events
for select using (user_id = auth.uid() or public.is_admin());
create policy "notification_events_admin_write" on public.notification_events
for all using (public.is_admin()) with check (public.is_admin());

create policy "feature_flags_authenticated_read" on public.feature_flags
for select using (auth.uid() is not null);
create policy "feature_flags_admin_write" on public.feature_flags
for all using (public.is_admin()) with check (public.is_admin());

create policy "feature_user_access_own_or_admin_read" on public.feature_user_access
for select using (user_id = auth.uid() or public.is_admin());
create policy "feature_user_access_admin_write" on public.feature_user_access
for all using (public.is_admin()) with check (public.is_admin());

create policy "community_posts_released_read" on public.community_posts
for select using (
  status = 'published'
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
create policy "community_posts_released_insert" on public.community_posts
for insert with check (
  author_id = auth.uid()
  and (
    exists (select 1 from public.feature_flags where key = 'community' and release_mode = 'all')
    or exists (
      select 1 from public.feature_user_access
      where feature_key = 'community'
        and user_id = auth.uid()
    )
  )
);
create policy "community_posts_author_or_admin_update" on public.community_posts
for update using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());

create policy "admin_action_logs_admin_read" on public.admin_action_logs
for select using (public.is_admin());
create policy "admin_action_logs_admin_insert" on public.admin_action_logs
for insert with check (public.is_admin());

insert into storage.buckets (id, name, public)
values
  ('child-photos', 'child-photos', false),
  ('report-exports', 'report-exports', false),
  ('material-files', 'material-files', false)
on conflict (id) do update set public = false;

create policy "child_photos_private_owner_path" on storage.objects
for all using (
  bucket_id = 'child-photos'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
) with check (
  bucket_id = 'child-photos'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);

create policy "report_exports_private_owner_path" on storage.objects
for all using (
  bucket_id = 'report-exports'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
) with check (
  bucket_id = 'report-exports'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);

create policy "material_files_admin_write_public_read_via_app" on storage.objects
for select using (bucket_id = 'material-files');

create policy "material_files_admin_write" on storage.objects
for all using (bucket_id = 'material-files' and public.is_admin())
with check (bucket_id = 'material-files' and public.is_admin());

create index classes_owner_id_idx on public.classes(owner_id);
create index students_owner_id_idx on public.students(owner_id);
create index students_class_id_idx on public.students(class_id);
create index annotations_owner_id_idx on public.annotations(owner_id);
create index annotation_targets_annotation_id_idx on public.annotation_targets(annotation_id);
create index student_timeline_events_student_idx on public.student_timeline_events(student_id, occurred_at desc);
create index reports_owner_id_idx on public.reports(owner_id);
create index reports_usage_owner_created_idx on public.reports_usage(owner_id, created_at desc);
create index materials_category_status_idx on public.materials(category_id, status);
create index notification_events_user_status_idx on public.notification_events(user_id, status);
create index feature_user_access_feature_user_idx on public.feature_user_access(feature_key, user_id);
create index community_posts_status_created_idx on public.community_posts(status, created_at desc);

insert into public.feature_flags (key, name, release_mode, description)
values ('community', 'Comunidade', 'selected', 'Feed de postagens entre professoras com liberacao gradual.')
on conflict (key) do nothing;
