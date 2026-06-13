alter table public.intervention_records
  add column if not exists activity_log jsonb not null default '[]'::jsonb;
