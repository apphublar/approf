-- AI usage foundation: GizTokens, semester entitlements, generation logs and paid extras.

alter table public.profiles
  add column if not exists estimated_student_count integer not null default 0
  check (estimated_student_count >= 0 and estimated_student_count <= 300);

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ai_wallet_period') then
    create type public.ai_wallet_period as enum ('monthly', 'semester', 'extra');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ai_generation_type') then
    create type public.ai_generation_type as enum (
      'development_report',
      'general_report',
      'planning',
      'portfolio_text',
      'portfolio_image',
      'specialist_report',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ai_charge_source') then
    create type public.ai_charge_source as enum ('giztokens', 'semester_entitlement', 'paid_extra');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ai_generation_status') then
    create type public.ai_generation_status as enum ('estimated', 'completed', 'failed', 'refunded');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ai_entitlement_type') then
    create type public.ai_entitlement_type as enum ('development_report', 'portfolio_image');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ai_purchase_status') then
    create type public.ai_purchase_status as enum ('pending', 'paid', 'failed', 'refunded');
  end if;
end $$;

create table if not exists public.ai_usage_wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  period_type public.ai_wallet_period not null,
  period_start date not null,
  period_end date not null,
  giztokens_included integer not null default 0 check (giztokens_included >= 0),
  giztokens_used integer not null default 0 check (giztokens_used >= 0),
  included_cost_limit_cents integer not null default 10000 check (included_cost_limit_cents >= 0),
  included_cost_used_cents integer not null default 0 check (included_cost_used_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, period_type, period_start, period_end),
  check (period_end >= period_start)
);

create table if not exists public.ai_semester_entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  entitlement_type public.ai_entitlement_type not null,
  cycle_label text not null,
  cycle_start date not null,
  cycle_end date not null,
  included_quantity integer not null default 0 check (included_quantity >= 0),
  used_quantity integer not null default 0 check (used_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, student_id, entitlement_type, cycle_start, cycle_end),
  check (cycle_end >= cycle_start)
);

create table if not exists public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  wallet_id uuid references public.ai_usage_wallets(id) on delete set null,
  entitlement_id uuid references public.ai_semester_entitlements(id) on delete set null,
  generation_type public.ai_generation_type not null,
  provider text not null,
  model text not null,
  charge_source public.ai_charge_source not null,
  status public.ai_generation_status not null default 'estimated',
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  image_count integer not null default 0 check (image_count >= 0),
  giztokens_charged integer not null default 0 check (giztokens_charged >= 0),
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  actual_cost_cents integer not null default 0 check (actual_cost_cents >= 0),
  prompt_version text,
  request_summary jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_extra_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider public.payment_provider not null default 'manual',
  status public.ai_purchase_status not null default 'pending',
  package_name text not null,
  generation_type public.ai_generation_type,
  giztokens_granted integer not null default 0 check (giztokens_granted >= 0),
  quantity_granted integer not null default 0 check (quantity_granted >= 0),
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  price_cents integer not null check (price_cents >= 0),
  external_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_usage_wallets enable row level security;
alter table public.ai_semester_entitlements enable row level security;
alter table public.ai_generation_logs enable row level security;
alter table public.ai_extra_credit_purchases enable row level security;

drop policy if exists "ai_usage_wallets_owner_read_admin_all" on public.ai_usage_wallets;
create policy "ai_usage_wallets_owner_read_admin_all" on public.ai_usage_wallets
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "ai_usage_wallets_admin_write" on public.ai_usage_wallets;
create policy "ai_usage_wallets_admin_write" on public.ai_usage_wallets
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ai_semester_entitlements_owner_read_admin_all" on public.ai_semester_entitlements;
create policy "ai_semester_entitlements_owner_read_admin_all" on public.ai_semester_entitlements
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "ai_semester_entitlements_admin_write" on public.ai_semester_entitlements;
create policy "ai_semester_entitlements_admin_write" on public.ai_semester_entitlements
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ai_generation_logs_owner_read_admin_all" on public.ai_generation_logs;
create policy "ai_generation_logs_owner_read_admin_all" on public.ai_generation_logs
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "ai_generation_logs_admin_write" on public.ai_generation_logs;
create policy "ai_generation_logs_admin_write" on public.ai_generation_logs
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ai_extra_credit_purchases_owner_read_admin_all" on public.ai_extra_credit_purchases;
create policy "ai_extra_credit_purchases_owner_read_admin_all" on public.ai_extra_credit_purchases
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "ai_extra_credit_purchases_admin_write" on public.ai_extra_credit_purchases;
create policy "ai_extra_credit_purchases_admin_write" on public.ai_extra_credit_purchases
for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists ai_usage_wallets_updated_at on public.ai_usage_wallets;
create trigger ai_usage_wallets_updated_at before update on public.ai_usage_wallets
for each row execute function public.set_updated_at();

drop trigger if exists ai_semester_entitlements_updated_at on public.ai_semester_entitlements;
create trigger ai_semester_entitlements_updated_at before update on public.ai_semester_entitlements
for each row execute function public.set_updated_at();

drop trigger if exists ai_extra_credit_purchases_updated_at on public.ai_extra_credit_purchases;
create trigger ai_extra_credit_purchases_updated_at before update on public.ai_extra_credit_purchases
for each row execute function public.set_updated_at();

create index if not exists ai_usage_wallets_owner_period_idx
on public.ai_usage_wallets(owner_id, period_type, period_start desc);

create index if not exists ai_semester_entitlements_owner_cycle_idx
on public.ai_semester_entitlements(owner_id, cycle_start desc, entitlement_type);

create index if not exists ai_semester_entitlements_student_idx
on public.ai_semester_entitlements(student_id, entitlement_type, cycle_start desc);

create index if not exists ai_generation_logs_owner_created_idx
on public.ai_generation_logs(owner_id, created_at desc);

create index if not exists ai_generation_logs_student_type_idx
on public.ai_generation_logs(student_id, generation_type, created_at desc);

create index if not exists ai_extra_credit_purchases_owner_status_idx
on public.ai_extra_credit_purchases(owner_id, status, created_at desc);
