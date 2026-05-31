-- Reapply the app owner's testing allowance using the Brazil-local billing month.

with target_period as (
  select
    date_trunc('month', timezone('America/Sao_Paulo', now()))::date as period_start,
    (
      date_trunc('month', timezone('America/Sao_Paulo', now()))
      + interval '1 month'
      - interval '1 day'
    )::date as period_end
)
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
from public.profiles profiles, target_period
where profiles.id = wallet.owner_id
  and lower(profiles.email) = 'fontinhasaline@gmail.com'
  and wallet.period_type = 'monthly'
  and wallet.period_start = target_period.period_start
  and wallet.period_end = target_period.period_end;

with target_period as (
  select
    date_trunc('month', timezone('America/Sao_Paulo', now()))::date as period_start,
    (
      date_trunc('month', timezone('America/Sao_Paulo', now()))
      + interval '1 month'
      - interval '1 day'
    )::date as period_end
)
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
  target_period.period_start,
  target_period.period_end,
  20000,
  2000,
  '[' || now()::text || '] Allowance de testes para dona do app: 20.000 GizTokens.'
from public.profiles profiles
cross join target_period
where lower(profiles.email) = 'fontinhasaline@gmail.com'
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
