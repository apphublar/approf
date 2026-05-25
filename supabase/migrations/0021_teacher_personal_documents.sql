-- Cross-device teacher personal documents.

create table if not exists public.teacher_personal_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  file_path text not null,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teacher_personal_documents enable row level security;

drop policy if exists "teacher_personal_documents_owner_all" on public.teacher_personal_documents;
create policy "teacher_personal_documents_owner_all"
on public.teacher_personal_documents
for all
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop trigger if exists teacher_personal_documents_updated_at on public.teacher_personal_documents;
create trigger teacher_personal_documents_updated_at
before update on public.teacher_personal_documents
for each row execute function public.set_updated_at();

create index if not exists teacher_personal_documents_owner_created_idx
on public.teacher_personal_documents(owner_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('teacher-documents', 'teacher-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "teacher_documents_owner_read" on storage.objects;
create policy "teacher_documents_owner_read" on storage.objects
for select using (
  bucket_id = 'teacher-documents'
  and (public.is_admin() or auth.uid()::text = split_part(name, '/', 1))
);

drop policy if exists "teacher_documents_owner_insert" on storage.objects;
create policy "teacher_documents_owner_insert" on storage.objects
for insert with check (
  bucket_id = 'teacher-documents'
  and (public.is_admin() or auth.uid()::text = split_part(name, '/', 1))
);

drop policy if exists "teacher_documents_owner_delete" on storage.objects;
create policy "teacher_documents_owner_delete" on storage.objects
for delete using (
  bucket_id = 'teacher-documents'
  and (public.is_admin() or auth.uid()::text = split_part(name, '/', 1))
);
