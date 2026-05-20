-- Support the v3 document refactor using the existing Approf schema.
-- The prompt uses Portuguese table names; this project stores the same domain in
-- students, classes, annotations and reports.

alter table public.students
  add column if not exists diagnosis text,
  add column if not exists milestones jsonb not null default '[]'::jsonb;

alter table public.reports
  add column if not exists learning_rights text[] not null default '{}',
  add column if not exists bncc_fields text[] not null default '{}',
  add column if not exists selected_milestones text[] not null default '{}',
  add column if not exists output_format text not null default 'document',
  add column if not exists planning_period text,
  add column if not exists project_duration text,
  add column if not exists methodology text,
  add column if not exists resources text,
  add column if not exists assessment_record text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reports_output_format_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_output_format_check
      check (output_format in ('document', 'image'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'reports_planning_period_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_planning_period_check
      check (planning_period is null or planning_period in ('diario', 'semanal'));
  end if;
end $$;

create table if not exists public.marcos_crianca (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.students(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  descricao text not null,
  data_marco date not null default current_date,
  categoria text check (
    categoria in (
      'linguagem',
      'motor',
      'social',
      'cognitivo',
      'autonomia',
      'emocional',
      'outro'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marcos_crianca enable row level security;

drop policy if exists "professora_acessa_proprios_marcos" on public.marcos_crianca;
create policy "professora_acessa_proprios_marcos"
on public.marcos_crianca
for all
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "service_role_full_access_marcos" on public.marcos_crianca;
create policy "service_role_full_access_marcos"
on public.marcos_crianca
for all
to service_role
using (true)
with check (true);

drop trigger if exists marcos_crianca_updated_at on public.marcos_crianca;
create trigger marcos_crianca_updated_at before update on public.marcos_crianca
for each row execute function public.set_updated_at();

create index if not exists idx_marcos_aluno on public.marcos_crianca(aluno_id);
create index if not exists idx_marcos_user on public.marcos_crianca(user_id);
create index if not exists idx_marcos_data on public.marcos_crianca(data_marco desc);

create index if not exists reports_owner_type_created_idx
on public.reports(owner_id, report_type, created_at desc);

alter type public.ai_generation_type add value if not exists 'classroom_journal';
alter type public.ai_generation_type add value if not exists 'planning_daily';
alter type public.ai_generation_type add value if not exists 'planning_weekly';
alter type public.ai_generation_type add value if not exists 'planning_project';
alter type public.ai_generation_type add value if not exists 'planning_meeting';
alter type public.ai_generation_type add value if not exists 'parents_meeting';

drop policy if exists "service_role_full_access_annotations" on public.annotations;
create policy "service_role_full_access_annotations"
on public.annotations
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_full_access_students" on public.students;
create policy "service_role_full_access_students"
on public.students
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_full_access_classes" on public.classes;
create policy "service_role_full_access_classes"
on public.classes
for all
to service_role
using (true)
with check (true);
