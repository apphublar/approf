-- Normalize wallets created before the cost-based GizToken rules.

update public.ai_generation_logs
set giztokens_charged = greatest(
  0,
  coalesce(nullif(actual_cost_cents, 0), estimated_cost_cents, 0) * 10
)
where charge_source = 'giztokens'
  and status in ('estimated', 'completed');

update public.ai_usage_wallets wallet
set
  giztokens_included = 6000,
  included_cost_limit_cents = 800,
  giztokens_used = coalesce(usage_totals.giztokens_used, 0),
  included_cost_used_cents = coalesce(usage_totals.cost_used_cents, 0)
from (
  select
    wallet_id,
    sum(case when charge_source = 'giztokens' then coalesce(giztokens_charged, 0) else 0 end)::integer as giztokens_used,
    sum(coalesce(nullif(actual_cost_cents, 0), estimated_cost_cents, 0))::integer as cost_used_cents
  from public.ai_generation_logs
  where wallet_id is not null
    and status in ('estimated', 'completed')
  group by wallet_id
) usage_totals
where wallet.id = usage_totals.wallet_id
  and wallet.period_type = 'monthly';

update public.ai_usage_wallets
set
  giztokens_included = 6000,
  included_cost_limit_cents = 800,
  giztokens_used = 0,
  included_cost_used_cents = 0
where period_type = 'monthly'
  and not exists (
    select 1
    from public.ai_generation_logs logs
    where logs.wallet_id = ai_usage_wallets.id
      and logs.status in ('estimated', 'completed')
  );

create or replace function public.reserve_ai_usage_atomic(
  p_owner_id uuid,
  p_generation_type public.ai_generation_type,
  p_class_id uuid default null,
  p_student_id uuid default null,
  p_prompt_version text default null,
  p_request_summary jsonb default '{}'::jsonb,
  p_provider text default 'anthropic',
  p_model text default 'claude-text',
  p_estimated_cost_cents integer default 0,
  p_estimated_input_tokens integer default 0,
  p_estimated_output_tokens integer default 0,
  p_estimated_image_count integer default 0,
  p_giztokens_cost integer default 0,
  p_entitlement_type public.ai_entitlement_type default null,
  p_month_period_start date default null,
  p_month_period_end date default null,
  p_monthly_giztokens_included integer default 0,
  p_included_cost_limit_cents integer default 0,
  p_semester_cycle_label text default null,
  p_semester_cycle_start date default null,
  p_semester_cycle_end date default null,
  p_semester_included_quantity integer default 0
)
returns table (
  allowed boolean,
  reason text,
  message text,
  charge_source public.ai_charge_source,
  log_id uuid,
  wallet_id uuid,
  entitlement_id uuid,
  wallet_giztokens_included integer,
  wallet_giztokens_used integer,
  wallet_included_cost_limit_cents integer,
  wallet_included_cost_used_cents integer,
  entitlement_cycle_label text,
  entitlement_included_quantity integer,
  entitlement_used_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.ai_usage_wallets%rowtype;
  v_entitlement public.ai_semester_entitlements%rowtype;
  v_log_id uuid;
  v_estimated_cost integer := greatest(0, coalesce(p_estimated_cost_cents, 0));
  v_giztokens_cost integer := greatest(0, coalesce(p_giztokens_cost, 0));
  v_next_cost integer;
  v_giztokens_hard_limit integer;
begin
  if p_month_period_start is null or p_month_period_end is null then
    raise exception 'AI monthly wallet period is required';
  end if;

  insert into public.ai_usage_wallets (
    owner_id,
    period_type,
    period_start,
    period_end,
    giztokens_included,
    included_cost_limit_cents
  )
  values (
    p_owner_id,
    'monthly',
    p_month_period_start,
    p_month_period_end,
    greatest(0, coalesce(p_monthly_giztokens_included, 0)),
    greatest(0, coalesce(p_included_cost_limit_cents, 0))
  )
  on conflict (owner_id, period_type, period_start, period_end)
  do update set
    giztokens_included = excluded.giztokens_included,
    included_cost_limit_cents = excluded.included_cost_limit_cents
  returning * into v_wallet;

  select * into v_wallet
  from public.ai_usage_wallets
  where id = v_wallet.id
  for update;

  v_next_cost := v_wallet.included_cost_used_cents + v_estimated_cost;
  v_giztokens_hard_limit := v_wallet.included_cost_limit_cents * 10;

  if v_next_cost > v_wallet.included_cost_limit_cents then
    return query
    select
      false,
      'included_cost_limit_reached'::text,
      'Seu limite mensal de IA foi concluido. A margem de seguranca ja foi usada; tente novamente no proximo ciclo.'::text,
      null::public.ai_charge_source,
      null::uuid,
      v_wallet.id,
      null::uuid,
      v_wallet.giztokens_included,
      v_wallet.giztokens_used,
      v_wallet.included_cost_limit_cents,
      v_wallet.included_cost_used_cents,
      null::text,
      null::integer,
      null::integer;
    return;
  end if;

  if p_entitlement_type is not null
    and p_semester_cycle_start is not null
    and p_semester_cycle_end is not null
    and greatest(0, coalesce(p_semester_included_quantity, 0)) > 0 then

    if p_entitlement_type = 'development_report'::public.ai_entitlement_type and p_student_id is not null then
      insert into public.ai_semester_entitlements (
        owner_id,
        student_id,
        class_id,
        entitlement_type,
        cycle_label,
        cycle_start,
        cycle_end,
        included_quantity
      )
      values (
        p_owner_id,
        p_student_id,
        p_class_id,
        p_entitlement_type,
        coalesce(p_semester_cycle_label, to_char(p_semester_cycle_start, 'YYYY')),
        p_semester_cycle_start,
        p_semester_cycle_end,
        greatest(0, coalesce(p_semester_included_quantity, 0))
      )
      on conflict (owner_id, student_id, entitlement_type, cycle_start, cycle_end)
      do update set
        included_quantity = greatest(ai_semester_entitlements.included_quantity, excluded.included_quantity)
      returning * into v_entitlement;
    elsif p_entitlement_type = 'portfolio_image'::public.ai_entitlement_type then
      insert into public.ai_semester_entitlements (
        owner_id,
        student_id,
        class_id,
        entitlement_type,
        cycle_label,
        cycle_start,
        cycle_end,
        included_quantity
      )
      values (
        p_owner_id,
        null,
        null,
        p_entitlement_type,
        coalesce(p_semester_cycle_label, to_char(p_semester_cycle_start, 'YYYY-MM')),
        p_semester_cycle_start,
        p_semester_cycle_end,
        greatest(0, coalesce(p_semester_included_quantity, 0))
      )
      on conflict (owner_id, entitlement_type, cycle_start, cycle_end) where student_id is null
      do update set
        included_quantity = greatest(ai_semester_entitlements.included_quantity, excluded.included_quantity)
      returning * into v_entitlement;
    end if;

    if v_entitlement.id is not null then
      select * into v_entitlement
      from public.ai_semester_entitlements
      where id = v_entitlement.id
      for update;

      if v_entitlement.used_quantity < v_entitlement.included_quantity then
        update public.ai_semester_entitlements
        set used_quantity = used_quantity + 1
        where id = v_entitlement.id
        returning * into v_entitlement;

        update public.ai_usage_wallets
        set included_cost_used_cents = v_next_cost
        where id = v_wallet.id
        returning * into v_wallet;

        insert into public.ai_generation_logs (
          owner_id,
          class_id,
          student_id,
          wallet_id,
          entitlement_id,
          generation_type,
          provider,
          model,
          charge_source,
          status,
          input_tokens,
          output_tokens,
          image_count,
          giztokens_charged,
          estimated_cost_cents,
          prompt_version,
          request_summary
        )
        values (
          p_owner_id,
          p_class_id,
          p_student_id,
          v_wallet.id,
          v_entitlement.id,
          p_generation_type,
          p_provider,
          p_model,
          'semester_entitlement',
          'estimated',
          greatest(0, coalesce(p_estimated_input_tokens, 0)),
          greatest(0, coalesce(p_estimated_output_tokens, 0)),
          greatest(0, coalesce(p_estimated_image_count, 0)),
          0,
          v_estimated_cost,
          coalesce(p_prompt_version, 'bncc-v1'),
          coalesce(p_request_summary, '{}'::jsonb)
        )
        returning id into v_log_id;

        return query
        select
          true,
          null::text,
          'Uso de IA registrado pela cota inclusa.'::text,
          'semester_entitlement'::public.ai_charge_source,
          v_log_id,
          v_wallet.id,
          v_entitlement.id,
          v_wallet.giztokens_included,
          v_wallet.giztokens_used,
          v_wallet.included_cost_limit_cents,
          v_wallet.included_cost_used_cents,
          v_entitlement.cycle_label,
          v_entitlement.included_quantity,
          v_entitlement.used_quantity;
        return;
      end if;
    end if;
  end if;

  if (v_wallet.giztokens_used + v_giztokens_cost) <= v_giztokens_hard_limit then
    update public.ai_usage_wallets
    set
      giztokens_used = giztokens_used + v_giztokens_cost,
      included_cost_used_cents = v_next_cost
    where id = v_wallet.id
    returning * into v_wallet;

    insert into public.ai_generation_logs (
      owner_id,
      class_id,
      student_id,
      wallet_id,
      generation_type,
      provider,
      model,
      charge_source,
      status,
      input_tokens,
      output_tokens,
      image_count,
      giztokens_charged,
      estimated_cost_cents,
      prompt_version,
      request_summary
    )
    values (
      p_owner_id,
      p_class_id,
      p_student_id,
      v_wallet.id,
      p_generation_type,
      p_provider,
      p_model,
      'giztokens',
      'estimated',
      greatest(0, coalesce(p_estimated_input_tokens, 0)),
      greatest(0, coalesce(p_estimated_output_tokens, 0)),
      greatest(0, coalesce(p_estimated_image_count, 0)),
      v_giztokens_cost,
      v_estimated_cost,
      coalesce(p_prompt_version, 'bncc-v1'),
      coalesce(p_request_summary, '{}'::jsonb)
    )
    returning id into v_log_id;

    return query
    select
      true,
      null::text,
      'Uso de IA reservado com GizTokens.'::text,
      'giztokens'::public.ai_charge_source,
      v_log_id,
      v_wallet.id,
      null::uuid,
      v_wallet.giztokens_included,
      v_wallet.giztokens_used,
      v_wallet.included_cost_limit_cents,
      v_wallet.included_cost_used_cents,
      null::text,
      null::integer,
      null::integer;
    return;
  end if;

  return query
  select
    false,
    'paid_extra_required'::text,
    'Seu saldo mensal de IA acabou. Para continuar, aguarde o proximo ciclo ou adquira um pacote extra.'::text,
    null::public.ai_charge_source,
    null::uuid,
    v_wallet.id,
    null::uuid,
    v_wallet.giztokens_included,
    v_wallet.giztokens_used,
    v_wallet.included_cost_limit_cents,
    v_wallet.included_cost_used_cents,
    null::text,
    null::integer,
    null::integer;
end;
$$;

revoke all on function public.reserve_ai_usage_atomic(
  uuid,
  public.ai_generation_type,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  public.ai_entitlement_type,
  date,
  date,
  integer,
  integer,
  text,
  date,
  date,
  integer
) from public;

grant execute on function public.reserve_ai_usage_atomic(
  uuid,
  public.ai_generation_type,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  public.ai_entitlement_type,
  date,
  date,
  integer,
  integer,
  text,
  date,
  date,
  integer
) to service_role;
