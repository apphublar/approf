-- AI moderation metadata for teacher-submitted support materials.

alter type public.material_status add value if not exists 'review_required';
alter type public.material_status add value if not exists 'blocked';

alter table public.materials
  add column if not exists ai_review jsonb not null default '{}'::jsonb,
  add column if not exists ai_confidence numeric(4,3),
  add column if not exists detected_category text,
  add column if not exists content_preview text,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

drop policy if exists "materials_public_read_published" on public.materials;
create policy "materials_public_read_published" on public.materials
for select using (status = 'published');

drop policy if exists "materials_teacher_insert_own" on public.materials;
create policy "materials_teacher_insert_own" on public.materials
for insert
with check (auth.uid() = submitted_by or public.is_admin());

drop policy if exists "materials_teacher_read_own_or_published" on public.materials;
create policy "materials_teacher_read_own_or_published" on public.materials
for select
using (status = 'published' or auth.uid() = submitted_by or public.is_admin());

