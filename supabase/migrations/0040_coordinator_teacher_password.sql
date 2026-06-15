-- Senha de acesso da coordenadora definida pela professora + compartilhamento por documento.

alter table public.profiles
  add column if not exists coordinator_access_password_hash text,
  add column if not exists coordinator_access_password_encrypted text,
  add column if not exists coordinator_access_password_updated_at timestamptz;

create table if not exists public.coordinator_document_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  coordinator_name text not null,
  coordinator_email text not null,
  share_token text not null unique,
  access_status text not null default 'pending'
    check (access_status in ('pending', 'verified', 'revoked')),
  verified_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, report_id, coordinator_email)
);

create index if not exists coordinator_document_shares_owner_report_idx
  on public.coordinator_document_shares(owner_id, report_id, updated_at desc);

alter table public.coordinator_document_shares enable row level security;

drop policy if exists "coordinator_document_shares_owner_or_admin" on public.coordinator_document_shares;
create policy "coordinator_document_shares_owner_or_admin" on public.coordinator_document_shares
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "coordinator_document_shares_owner_write" on public.coordinator_document_shares;
create policy "coordinator_document_shares_owner_write" on public.coordinator_document_shares
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());
