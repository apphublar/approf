-- Coordinator review flow for development reports.

alter table public.reports
  add column if not exists coordinator_review_status text
    check (coordinator_review_status in ('not_required', 'pending', 'changes_requested', 'approved')),
  add column if not exists coordinator_review_notes text,
  add column if not exists coordinator_reviewed_by text,
  add column if not exists coordinator_reviewed_at timestamptz;

update public.reports
set coordinator_review_status = case
  when report_type = 'development_report' then 'pending'
  else 'not_required'
end
where coordinator_review_status is null;

create table if not exists public.coordinator_class_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  coordinator_name text not null,
  coordinator_email text not null,
  share_token text not null unique,
  access_status text not null default 'pending' check (access_status in ('pending', 'verified', 'revoked')),
  verified_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, class_id, coordinator_email)
);

create table if not exists public.coordinator_access_codes (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.coordinator_class_shares(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.report_review_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  actor_type text not null check (actor_type in ('teacher', 'coordinator', 'system')),
  actor_name text,
  actor_email text,
  action text not null,
  notes text,
  previous_status text,
  next_status text,
  created_at timestamptz not null default now()
);

create index if not exists coordinator_class_shares_owner_class_idx
  on public.coordinator_class_shares(owner_id, class_id);

create index if not exists report_review_events_report_idx
  on public.report_review_events(report_id, created_at desc);

create index if not exists reports_review_status_idx
  on public.reports(owner_id, student_id, report_type, coordinator_review_status);

create or replace function public.set_development_report_review_status()
returns trigger
language plpgsql
as $$
begin
  if new.report_type = 'development_report' then
    new.coordinator_review_status := coalesce(new.coordinator_review_status, 'pending');
  else
    new.coordinator_review_status := coalesce(new.coordinator_review_status, 'not_required');
  end if;
  return new;
end;
$$;

drop trigger if exists reports_set_development_review_status on public.reports;
create trigger reports_set_development_review_status
before insert on public.reports
for each row execute function public.set_development_report_review_status();

alter table public.coordinator_class_shares enable row level security;
alter table public.coordinator_access_codes enable row level security;
alter table public.report_review_events enable row level security;

drop policy if exists "coordinator_class_shares_owner_or_admin" on public.coordinator_class_shares;
create policy "coordinator_class_shares_owner_or_admin" on public.coordinator_class_shares
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "coordinator_class_shares_owner_write" on public.coordinator_class_shares;
create policy "coordinator_class_shares_owner_write" on public.coordinator_class_shares
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "report_review_events_owner_or_admin" on public.report_review_events;
create policy "report_review_events_owner_or_admin" on public.report_review_events
for select using (owner_id = auth.uid() or public.is_admin());
