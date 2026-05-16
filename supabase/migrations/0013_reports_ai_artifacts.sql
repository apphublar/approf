-- Store generated AI artifacts such as portfolio images alongside reports.

alter table public.reports
  add column if not exists ai_artifacts jsonb not null default '{}'::jsonb;

create index if not exists reports_owner_type_created_idx
on public.reports(owner_id, report_type, created_at desc);
