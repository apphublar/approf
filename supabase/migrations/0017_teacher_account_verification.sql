-- Teacher account controls: profile verification requests and private documents.

create table if not exists public.teacher_profile_verifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  school_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes text,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teacher_profile_verifications enable row level security;

drop policy if exists "teacher_profile_verifications_owner_all" on public.teacher_profile_verifications;
create policy "teacher_profile_verifications_owner_all"
on public.teacher_profile_verifications
for all
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "teacher_profile_verifications_service_role_all" on public.teacher_profile_verifications;
create policy "teacher_profile_verifications_service_role_all"
on public.teacher_profile_verifications
for all
to service_role
using (true)
with check (true);

drop trigger if exists teacher_profile_verifications_updated_at on public.teacher_profile_verifications;
create trigger teacher_profile_verifications_updated_at
before update on public.teacher_profile_verifications
for each row execute function public.set_updated_at();

create index if not exists teacher_profile_verifications_owner_created_idx
on public.teacher_profile_verifications(owner_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('profile-verification', 'profile-verification', false)
on conflict (id) do update set public = false;

drop policy if exists "profile_verification_private_owner_path" on storage.objects;
create policy "profile_verification_private_owner_path" on storage.objects
for all using (
  bucket_id = 'profile-verification'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
) with check (
  bucket_id = 'profile-verification'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);
