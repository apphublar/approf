alter table public.profiles
  add column if not exists teacher_code text;

create unique index if not exists profiles_teacher_code_unique_idx
  on public.profiles (teacher_code)
  where teacher_code is not null;

create table if not exists public.intervention_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_acompanhamento', 'concluida', 'descartada')),
  observation_initial text not null default '',
  suggestions jsonb not null default '[]'::jsonb,
  chosen_intervention jsonb,
  teacher_return text,
  return_choice text
    check (return_choice is null or return_choice in ('houve_avanco', 'houve_avanco_parcial', 'necessita_acompanhamento')),
  ai_analysis text,
  evolution_record text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuity_request_type') then
    create type public.continuity_request_type as enum ('link', 'transfer_teacher', 'transfer_class');
  end if;
  if not exists (select 1 from pg_type where typname = 'continuity_request_status') then
    create type public.continuity_request_status as enum ('pending', 'approved', 'rejected', 'canceled');
  end if;
end $$;

create table if not exists public.student_continuity_requests (
  id uuid primary key default gen_random_uuid(),
  request_type public.continuity_request_type not null,
  status public.continuity_request_status not null default 'pending',
  requester_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  from_owner_id uuid not null references public.profiles(id) on delete cascade,
  target_owner_id uuid references public.profiles(id) on delete set null,
  target_class_id uuid references public.classes(id) on delete set null,
  target_teacher_code text,
  reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intervention_records_owner_student_idx
  on public.intervention_records(owner_id, student_id, created_at desc);

create index if not exists student_continuity_requests_requester_idx
  on public.student_continuity_requests(requester_id, created_at desc);

create index if not exists student_continuity_requests_from_owner_idx
  on public.student_continuity_requests(from_owner_id, status, created_at desc);

create index if not exists student_continuity_requests_student_idx
  on public.student_continuity_requests(student_id, created_at desc);

drop trigger if exists intervention_records_updated_at on public.intervention_records;
create trigger intervention_records_updated_at
before update on public.intervention_records
for each row execute function public.set_updated_at();

drop trigger if exists student_continuity_requests_updated_at on public.student_continuity_requests;
create trigger student_continuity_requests_updated_at
before update on public.student_continuity_requests
for each row execute function public.set_updated_at();

alter table public.intervention_records enable row level security;
alter table public.student_continuity_requests enable row level security;

drop policy if exists "intervention_records_owner_all" on public.intervention_records;
create policy "intervention_records_owner_all" on public.intervention_records
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "continuity_requests_participant_read" on public.student_continuity_requests;
create policy "continuity_requests_participant_read" on public.student_continuity_requests
for select using (
  requester_id = auth.uid()
  or from_owner_id = auth.uid()
  or target_owner_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "continuity_requests_requester_insert" on public.student_continuity_requests;
create policy "continuity_requests_requester_insert" on public.student_continuity_requests
for insert with check (requester_id = auth.uid());

drop policy if exists "continuity_requests_participant_update" on public.student_continuity_requests;
create policy "continuity_requests_participant_update" on public.student_continuity_requests
for update using (
  requester_id = auth.uid()
  or from_owner_id = auth.uid()
  or public.is_admin()
)
with check (
  requester_id = auth.uid()
  or from_owner_id = auth.uid()
  or public.is_admin()
);

create or replace function public.ensure_teacher_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix integer := 0;
begin
  if new.teacher_code is not null and length(trim(new.teacher_code)) > 0 then
    return new;
  end if;

  base := upper(
    regexp_replace(
      coalesce(nullif(split_part(new.full_name, ' ', 1), ''), 'PROF'),
      '[^A-Z0-9]',
      '',
      'g'
    )
  );
  if length(base) < 2 then
    base := 'PROF';
  end if;

  candidate := 'PROF-' || left(base, 8) || '-' || to_char(now(), 'YYYY');
  while exists (select 1 from public.profiles where teacher_code = candidate and id <> new.id) loop
    suffix := suffix + 1;
    candidate := 'PROF-' || left(base, 6) || suffix::text || '-' || to_char(now(), 'YYYY');
  end loop;

  new.teacher_code := candidate;
  return new;
end;
$$;

drop trigger if exists profiles_teacher_code_bootstrap on public.profiles;
create trigger profiles_teacher_code_bootstrap
before insert or update of full_name, teacher_code on public.profiles
for each row execute function public.ensure_teacher_code();

update public.profiles
set teacher_code = null
where teacher_code is not null and length(trim(teacher_code)) = 0;

update public.profiles
set full_name = full_name
where teacher_code is null;
