-- Basic version marker for generated pedagogical documents.

alter table public.reports
  add column if not exists is_final_version boolean not null default false;

create index if not exists reports_owner_student_type_created_idx
on public.reports(owner_id, student_id, report_type, created_at desc);

create unique index if not exists reports_one_final_per_student_type_idx
on public.reports(owner_id, student_id, report_type)
where is_final_version = true and student_id is not null;
