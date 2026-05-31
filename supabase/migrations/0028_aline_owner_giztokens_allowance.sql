-- Grant a larger current-month AI testing allowance to the app owner.

update public.ai_usage_wallets as wallet
set
  giztokens_included = greatest(wallet.giztokens_included, 20000),
  included_cost_limit_cents = greatest(wallet.included_cost_limit_cents, 2000),
  notes = concat_ws(
    E'\n',
    nullif(wallet.notes, ''),
    '[' || now()::text || '] Allowance de testes para dona do app: minimo de 20.000 GizTokens.'
  ),
  updated_at = now()
from public.profiles profiles
where profiles.id = wallet.owner_id
  and lower(profiles.email) = 'fontinhasaline@gmail.com'
  and wallet.period_type = 'monthly'
  and wallet.period_start = date_trunc('month', now())::date
  and wallet.period_end = (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;

insert into public.ai_usage_wallets as wallet (
  owner_id,
  period_type,
  period_start,
  period_end,
  giztokens_included,
  included_cost_limit_cents,
  notes
)
select
  profiles.id,
  'monthly',
  date_trunc('month', now())::date,
  (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date,
  20000,
  2000,
  '[' || now()::text || '] Allowance de testes para dona do app: 20.000 GizTokens.'
from public.profiles profiles
where lower(profiles.email) = 'fontinhasaline@gmail.com'
  and not exists (
    select 1
    from public.ai_usage_wallets existing_wallet
    where existing_wallet.owner_id = profiles.id
      and existing_wallet.period_type = 'monthly'
      and existing_wallet.period_start = date_trunc('month', now())::date
      and existing_wallet.period_end = (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date
  )
on conflict (owner_id, period_type, period_start, period_end)
do update set
  giztokens_included = greatest(wallet.giztokens_included, excluded.giztokens_included),
  included_cost_limit_cents = greatest(wallet.included_cost_limit_cents, excluded.included_cost_limit_cents),
  notes = concat_ws(
    E'\n',
    nullif(wallet.notes, ''),
    '[' || now()::text || '] Allowance de testes para dona do app: minimo de 20.000 GizTokens.'
  ),
  updated_at = now();
