-- Transactional and idempotent settlement/refund for AI usage reservations.

create or replace function public.finalize_ai_usage_reservation(
  p_log_id uuid,
  p_actual_cost_cents integer,
  p_result_summary jsonb default '{}'::jsonb
)
returns table (
  status public.ai_generation_status,
  actual_cost_cents integer,
  settled boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.ai_generation_logs%rowtype;
  v_actual_cost integer := greatest(0, coalesce(p_actual_cost_cents, 0));
  v_delta_cost integer;
  v_wallet public.ai_usage_wallets%rowtype;
begin
  select * into v_log
  from public.ai_generation_logs
  where id = p_log_id
  for update;

  if not found then
    raise exception 'AI generation log not found';
  end if;

  if v_log.status = 'completed' then
    return query
    select v_log.status, coalesce(v_log.actual_cost_cents, 0), false;
    return;
  end if;

  if v_log.status = 'refunded' then
    return query
    select v_log.status, coalesce(v_log.actual_cost_cents, 0), false;
    return;
  end if;

  if v_log.wallet_id is not null then
    select * into v_wallet
    from public.ai_usage_wallets
    where id = v_log.wallet_id
    for update;

    if not found then
      raise exception 'AI wallet not found';
    end if;

    v_delta_cost := v_actual_cost - coalesce(v_log.estimated_cost_cents, 0);
    if v_delta_cost <> 0 then
      update public.ai_usage_wallets
      set included_cost_used_cents = greatest(0, included_cost_used_cents + v_delta_cost)
      where id = v_wallet.id;
    end if;
  end if;

  update public.ai_generation_logs
  set
    status = 'completed',
    actual_cost_cents = v_actual_cost,
    result_summary = coalesce(result_summary, '{}'::jsonb) || coalesce(p_result_summary, '{}'::jsonb),
    error_message = null
  where id = p_log_id;

  return query
  select 'completed'::public.ai_generation_status, v_actual_cost, true;
end;
$$;

create or replace function public.refund_ai_usage_reservation(
  p_log_id uuid,
  p_reason text,
  p_status public.ai_generation_status default 'refunded',
  p_reserved_cost_override integer default null
)
returns table (
  status public.ai_generation_status,
  refunded boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.ai_generation_logs%rowtype;
  v_wallet public.ai_usage_wallets%rowtype;
  v_entitlement public.ai_semester_entitlements%rowtype;
  v_reserved_cost integer;
begin
  select * into v_log
  from public.ai_generation_logs
  where id = p_log_id
  for update;

  if not found then
    raise exception 'AI generation log not found';
  end if;

  if v_log.status in ('refunded', 'failed') then
    return query
    select v_log.status, false;
    return;
  end if;

  v_reserved_cost := greatest(
    0,
    coalesce(p_reserved_cost_override, nullif(v_log.actual_cost_cents, 0), v_log.estimated_cost_cents, 0)
  );

  if v_log.wallet_id is not null then
    select * into v_wallet
    from public.ai_usage_wallets
    where id = v_log.wallet_id
    for update;

    if not found then
      raise exception 'AI wallet not found';
    end if;

    if v_log.charge_source = 'giztokens' then
      update public.ai_usage_wallets
      set
        giztokens_used = greatest(0, giztokens_used - coalesce(v_log.giztokens_charged, 0)),
        included_cost_used_cents = greatest(0, included_cost_used_cents - v_reserved_cost)
      where id = v_wallet.id;
    else
      update public.ai_usage_wallets
      set included_cost_used_cents = greatest(0, included_cost_used_cents - v_reserved_cost)
      where id = v_wallet.id;
    end if;
  end if;

  if v_log.charge_source = 'semester_entitlement' and v_log.entitlement_id is not null then
    select * into v_entitlement
    from public.ai_semester_entitlements
    where id = v_log.entitlement_id
    for update;

    if not found then
      raise exception 'AI entitlement not found';
    end if;

    update public.ai_semester_entitlements
    set used_quantity = greatest(0, used_quantity - 1)
    where id = v_entitlement.id;
  end if;

  update public.ai_generation_logs
  set
    status = p_status,
    actual_cost_cents = 0,
    error_message = left(coalesce(p_reason, 'Falha na geracao de IA.'), 2000),
    result_summary = coalesce(result_summary, '{}'::jsonb) || jsonb_build_object(
      'refundedAt', now(),
      'refundReason', left(coalesce(p_reason, 'Falha na geracao de IA.'), 200)
    )
  where id = p_log_id;

  return query
  select p_status, true;
end;
$$;

revoke all on function public.finalize_ai_usage_reservation(uuid, integer, jsonb) from public;
revoke all on function public.refund_ai_usage_reservation(uuid, text, public.ai_generation_status, integer) from public;

grant execute on function public.finalize_ai_usage_reservation(uuid, integer, jsonb) to service_role;
grant execute on function public.refund_ai_usage_reservation(uuid, text, public.ai_generation_status, integer) to service_role;
