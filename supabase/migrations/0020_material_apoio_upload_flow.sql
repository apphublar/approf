-- Robust support-material upload flow.

alter type public.material_status add value if not exists 'em_analise';

alter table public.materials
  add column if not exists type text,
  add column if not exists age_range text,
  add column if not exists pedagogical_objective text,
  add column if not exists file_url text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists author_id uuid references public.profiles(id) on delete set null,
  add column if not exists author_name text,
  add column if not exists author_avatar text,
  add column if not exists ai_analysis_status text not null default 'pending';

insert into storage.buckets (id, name, public)
values ('material-apoio', 'material-apoio', false)
on conflict (id) do update set public = false;

drop policy if exists "material_apoio_owner_read" on storage.objects;
create policy "material_apoio_owner_read" on storage.objects
for select using (
  bucket_id = 'material-apoio'
  and (
    auth.uid()::text = split_part(name, '/', 1)
    or public.is_admin()
    or exists (
      select 1
      from public.materials m
      where m.file_path = storage.objects.name
        and m.status = 'published'
    )
  )
);

drop policy if exists "material_apoio_owner_insert" on storage.objects;
create policy "material_apoio_owner_insert" on storage.objects
for insert with check (
  bucket_id = 'material-apoio'
  and (auth.uid()::text = split_part(name, '/', 1) or public.is_admin())
);

drop policy if exists "material_apoio_owner_update" on storage.objects;
create policy "material_apoio_owner_update" on storage.objects
for update using (
  bucket_id = 'material-apoio'
  and (auth.uid()::text = split_part(name, '/', 1) or public.is_admin())
)
with check (
  bucket_id = 'material-apoio'
  and (auth.uid()::text = split_part(name, '/', 1) or public.is_admin())
);

drop policy if exists "material_apoio_owner_delete" on storage.objects;
create policy "material_apoio_owner_delete" on storage.objects
for delete using (
  bucket_id = 'material-apoio'
  and (auth.uid()::text = split_part(name, '/', 1) or public.is_admin())
);

drop policy if exists "materials_teacher_read_own_or_published" on public.materials;
create policy "materials_teacher_read_own_or_published" on public.materials
for select
using (status = 'published' or auth.uid() = submitted_by or auth.uid() = author_id or public.is_admin());

drop policy if exists "materials_teacher_insert_own" on public.materials;
create policy "materials_teacher_insert_own" on public.materials
for insert
with check (auth.uid() = submitted_by or auth.uid() = author_id or public.is_admin());
