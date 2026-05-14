create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  attendance_date date not null,
  present_student_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, attendance_date)
);

alter table public.attendance_records enable row level security;

drop policy if exists "attendance_records_owner_all" on public.attendance_records;
create policy "attendance_records_owner_all" on public.attendance_records
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop trigger if exists attendance_records_updated_at on public.attendance_records;
create trigger attendance_records_updated_at before update on public.attendance_records
for each row execute function public.set_updated_at();

create index if not exists attendance_records_owner_date_idx
on public.attendance_records(owner_id, attendance_date desc);

create index if not exists attendance_records_class_date_idx
on public.attendance_records(class_id, attendance_date desc);
